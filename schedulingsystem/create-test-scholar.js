// Quick script to create a test scholar
// Run with: node create-test-scholar.js

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

async function createTestScholar() {
  const email = 'test.icle@garagescholars.com';
  const password = 'password123';
  const name = 'Test Icle';

  try {
    // Create auth user
    console.log('Creating auth user...');
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name
    });
    console.log('✅ Auth user created:', userRecord.uid);

    // Create Firestore user doc
    console.log('Creating Firestore user document...');
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      name: name,
      role: 'scholar',
      status: 'active',
      monthlyGoal: 3000,
      avatarInitials: 'TI',
      achievedMilestones: [],
      phoneNumber: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Firestore user document created');

    console.log('\n🎉 Test scholar created successfully!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 UID:', userRecord.uid);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

createTestScholar();
