// Initialize Firebase with config loaded from firebase-config.js
// Note: firebase-config.js must be loaded before this script
firebase.initializeApp(window.firebaseConfig);
const functions = firebase.functions();

// For development/testing, uncomment to use local emulator:
// functions.useEmulator("localhost", 5001);

function openQuoteModal(packageType) {
    document.getElementById('quoteModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Pre-select package if provided
    if (packageType) {
        const packageSelect = document.getElementById('package');
        if (packageSelect) {
            packageSelect.value = packageType;
        }
    }
}

function closeQuoteModal() {
    document.getElementById('quoteModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('quoteForm').reset();
    document.getElementById('formMessage').textContent = '';
    document.getElementById('formMessage').className = 'form-message';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('quoteModal');
    if (event.target === modal) {
        closeQuoteModal();
    }
}

// Handle form submission
document.getElementById('quoteForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formMessage = document.getElementById('formMessage');
    const submitButton = this.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
        const formData = new FormData(this);

        // Prepare data object
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            zipcode: formData.get('zipcode'),
            serviceType: formData.get('serviceType'),
            package: formData.get('package'),
            garageSize: formData.get('garageSize') || '',
            description: formData.get('description') || '',
            photoData: []
        };

        // Handle photo uploads - convert to base64
        const photoFiles = formData.getAll('photos').filter(f => f.size > 0);

        // Validate minimum 3 photos
        if (!photoFiles || photoFiles.length < 3) {
            formMessage.textContent = 'Please upload at least 3 photos of your garage.';
            formMessage.className = 'form-message error';
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Quote Request';
            return;
        }

        if (photoFiles && photoFiles.length > 0) {
            formMessage.textContent = 'Processing photos...';
            formMessage.className = 'form-message';
            formMessage.style.display = 'block';

            for (const file of photoFiles) {
                if (file.size > 0) {
                    try {
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
                                const base64String = result.split(',')[1];
                                resolve(base64String);
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });

                        data.photoData.push({
                            base64: base64,
                            filename: file.name,
                            mimeType: file.type
                        });
                    } catch (photoError) {
                        console.error('Error processing photo:', photoError);
                    }
                }
            }
        }

        // Call Firebase Function
        formMessage.textContent = 'Submitting your request...';
        const submitQuoteRequest = functions.httpsCallable('submitQuoteRequest');
        const result = await submitQuoteRequest(data);

        console.log('Quote submitted successfully:', result.data);

        formMessage.textContent = 'Thank you! Your quote request has been submitted. We\'ll contact you soon.';
        formMessage.className = 'form-message success';

        // Reset form after 3 seconds
        setTimeout(() => {
            closeQuoteModal();
        }, 3000);

    } catch (error) {
        console.error('Error submitting form:', error);
        let errorMessage = 'There was an error submitting your request. Please try again.';

        if (error.code === 'invalid-argument') {
            errorMessage = 'Please fill in all required fields.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }

        formMessage.textContent = errorMessage;
        formMessage.className = 'form-message error';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Quote Request';
    }
});
