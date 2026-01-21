import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ADMIN_EMAILS } from "../config";

type Role = "admin" | "scholar";
type Status = "active" | "disabled" | "pending";

type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: Status;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  viewAsUid: string | null;
  setViewAsUid: (uid: string | null) => void;
  effectiveUid: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const setPendingEmail = (email?: string | null) => {
  if (email) localStorage.setItem("pendingEmail", email);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewAsUid, setViewAsUid] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setAuthError("Firebase not initialized.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setProfile(null);
      setAuthError(null);

      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      const email = (firebaseUser.email || "").toLowerCase();
      const isAdminEmail = ADMIN_EMAILS.includes(email);
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (isAdminEmail) {
        const name = firebaseUser.displayName || email.split("@")[0] || "Admin";
        await setDoc(userRef, {
          email,
          name,
          role: "admin",
          status: "active",
          createdAt: serverTimestamp()
        }, { merge: true });
      } else if (!userSnap.exists()) {
        setPendingEmail(email);
        await signOut(auth);
        setLoading(false);
        return;
      }

      const liveUnsub = onSnapshot(userRef, async (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          return;
        }
        const data = snap.data() as {
          email?: string;
          name?: string;
          role?: Role;
          status?: Status;
        };
        const role = isAdminEmail ? "admin" : (data.role || "scholar");
        const status = isAdminEmail ? "active" : (data.status || "pending");
        setProfile({
          uid: firebaseUser.uid,
          email: data.email || email,
          name: data.name || firebaseUser.displayName || email.split("@")[0] || "Scholar",
          role,
          status
        });

        if (status === "active") {
          localStorage.removeItem("pendingEmail");
        }

        if (!isAdminEmail && status !== "active") {
          setPendingEmail(email);
          await signOut(auth);
        }
      });

      setLoading(false);
      return () => liveUnsub();
    });

    return () => unsubscribe();
  }, []);

  const effectiveUid = viewAsUid || user?.uid || null;

  useEffect(() => {
    if (profile?.role !== "admin") {
      setViewAsUid(null);
    }
  }, [profile?.role]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    authError,
    viewAsUid,
    setViewAsUid,
    effectiveUid
  }), [user, profile, loading, authError, viewAsUid, effectiveUid]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
