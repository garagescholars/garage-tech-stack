import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import { ADMIN_EMAILS } from "../constants/config";
import type { Role, UserProfile, UserStatus, ScholarTier } from "../types";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signOutUser: () => Promise<void>;
  verifyPhone: (verificationId: string, code: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  viewAsUid: string | null;
  setViewAsUid: (uid: string | null) => void;
  effectiveUid: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewAsUid, setViewAsUid] = useState<string | null>(null);

  const effectiveUid = viewAsUid || user?.uid || null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setProfile(null);
      setAuthError(null);

      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      const email = (firebaseUser.email || "").toLowerCase();
      const phone = firebaseUser.phoneNumber || "";
      const isAdminEmail = ADMIN_EMAILS.includes(email);
      const profileRef = doc(db, COLLECTIONS.PROFILES, firebaseUser.uid);
      const scholarRef = doc(db, COLLECTIONS.SCHOLAR_PROFILES, firebaseUser.uid);

      // Admin by email
      if (isAdminEmail) {
        const adminProfile: UserProfile = {
          uid: firebaseUser.uid,
          email,
          name: email.split("@")[0] || "Admin",
          role: "admin",
          status: "active",
          phoneNumber: phone,
        };
        setProfile(adminProfile);
        setLoading(false);
        setDoc(profileRef, {
          role: "admin",
          fullName: adminProfile.name,
          email,
          phone,
          isActive: true,
          createdAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});
        return;
      }

      // Check for existing profile
      let profileSnap;
      try {
        profileSnap = await getDoc(profileRef);
      } catch {
        setAuthError("Unable to load profile. Please try again.");
        setLoading(false);
        return;
      }

      // New user — create profile as scholar in BOTH collections
      if (!profileSnap.exists()) {
        const name = firebaseUser.displayName || phone || "Scholar";
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email,
          name,
          role: "scholar",
          status: "active",
          phoneNumber: phone,
        };

        // Write gs_profiles doc
        await setDoc(profileRef, {
          role: "scholar",
          fullName: name,
          email,
          phone,
          isActive: true,
          createdAt: serverTimestamp(),
        }).catch(() => {});

        // Write gs_scholarProfiles doc
        await setDoc(scholarRef, {
          scholarId: firebaseUser.uid,
          scholarName: name,
          payScore: 5.0,
          tier: "new",
          totalJobsCompleted: 0,
          totalEarnings: 0,
          cancellationRate: 0,
          acceptanceRate: 100,
          monthlyJobGoal: 0,
          monthlyMoneyGoal: 0,
          showOnLeaderboard: true,
          createdAt: serverTimestamp(),
        }).catch(() => {});

        setProfile(newProfile);
        setLoading(false);
        return;
      }

      // Existing user — subscribe to live updates from BOTH collections
      const liveProfileUnsub = onSnapshot(profileRef, (profileDoc) => {
        if (!profileDoc.exists()) {
          setProfile(null);
          return;
        }
        const pData = profileDoc.data() as Record<string, unknown>;
        const isActive = pData.isActive as boolean;

        // Build base profile from gs_profiles
        const baseProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: (pData.email as string) || email,
          name: (pData.fullName as string) || firebaseUser.displayName || phone || "Scholar",
          role: (pData.role as Role) || "scholar",
          status: isActive === false ? "disabled" : "active",
          phoneNumber: (pData.phone as string) || phone,
          avatarUrl: pData.avatarUrl as string | undefined,
          pushToken: pData.pushToken as string | undefined,
        };

        // Merge with current state (scholar data may already be set)
        setProfile((prev) => {
          if (prev && prev.uid === firebaseUser.uid) {
            return { ...prev, ...baseProfile };
          }
          return baseProfile;
        });

        if (isActive === false) {
          signOut(auth);
        }
      });

      // Subscribe to gs_scholarProfiles for scholar-specific data
      const liveScholarUnsub = onSnapshot(scholarRef, (scholarDoc) => {
        if (!scholarDoc.exists()) return;
        const sData = scholarDoc.data() as Record<string, unknown>;

        setProfile((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            payScore: sData.payScore as number | undefined,
            tier: sData.tier as ScholarTier | undefined,
            totalJobsCompleted: sData.totalJobsCompleted as number | undefined,
            totalEarnings: sData.totalEarnings as number | undefined,
            cancellationRate: sData.cancellationRate as number | undefined,
            acceptanceRate: sData.acceptanceRate as number | undefined,
            monthlyJobGoal: sData.monthlyJobGoal as number | undefined,
            monthlyMoneyGoal: sData.monthlyMoneyGoal as number | undefined,
            showOnLeaderboard: sData.showOnLeaderboard as boolean | undefined,
            onboardingComplete: sData.onboardingComplete as boolean | undefined,
          };
        });
      });

      setLoading(false);
      return () => {
        liveProfileUnsub();
        liveScholarUnsub();
      };
    });

    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    await signOut(auth);
    setProfile(null);
    setViewAsUid(null);
  };

  const verifyPhone = async (verificationId: string, code: string) => {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    await signInWithCredential(auth, credential);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authError,
      signOutUser,
      verifyPhone,
      signInWithEmail,
      viewAsUid,
      setViewAsUid,
      effectiveUid,
    }),
    [user, profile, loading, authError, viewAsUid]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
