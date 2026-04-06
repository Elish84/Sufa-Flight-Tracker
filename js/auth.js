// Firebase Authentication Handler for Sufa Flight Tracker

const Auth = {
    // Current user state
    user: null,
    isAdmin: false,

    init: () => {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                Auth.user = user;
                Auth.isAdmin = await Database.checkIfAdmin();
                
                // Show main container
                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('main-container').classList.remove('hidden');
                
                // Show admin nav if admin
                if (Auth.isAdmin) {
                    document.getElementById('nav-item-admin').classList.remove('hidden');
                } else {
                    document.getElementById('nav-item-admin').classList.add('hidden');
                }
                
                // Initial data load
                App.onLoginSuccess();
            } else {
                Auth.user = null;
                Auth.isAdmin = false;
                
                // Show login screen
                document.getElementById('auth-container').classList.remove('hidden');
                document.getElementById('main-container').classList.add('hidden');
            }
        });

        // Login form submission
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorElement = document.getElementById('auth-error');
            
            try {
                errorElement.innerText = '';
                await auth.signInWithEmailAndPassword(email, password);
                Utils.showToast('ברוך בואך!', 'success');
            } catch (error) {
                console.error('Login error:', error);
                errorElement.innerText = 'דואר אלקטרוני או סיסמה שגויים';
            }
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            auth.signOut();
            Utils.showToast('יצאת מהמערכת', 'info');
        });
    }
};
