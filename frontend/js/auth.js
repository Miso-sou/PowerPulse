let cognitoUser;
let userPool;

function initCognito() {
    // Check if SDK is loaded
    if (typeof AmazonCognitoIdentity === 'undefined') {
        console.error('Cognito SDK not loaded!');
        showMessage('Authentication service not loaded. Please refresh the page.', 'danger');
        return false;
    }

    const poolData = {
        UserPoolId: AWS_CONFIG.userPoolId,
        ClientId: AWS_CONFIG.clientId
    };
    userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    return true;
}

function toggleForms() {
    document.getElementById('loginForm').style.display =
        document.getElementById('loginForm').style.display === 'none' ? 'block' : 'none';
    document.getElementById('signupForm').style.display =
        document.getElementById('signupForm').style.display === 'none' ? 'block' : 'none';
}

function showVerifyForm(email) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('verifyForm').style.display = 'block';
    document.getElementById('verifyEmail').value = email;
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('verifyForm').style.display = 'none';
}

function showMessage(message, type) {
    const messageEl = document.getElementById('authMessage');
    messageEl.textContent = message;
    messageEl.className = `alert alert-${type}`;
    messageEl.style.display = 'block';
}

function handleSignup() {
    if (!initCognito()) return;

    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

    if (!email || !password || !passwordConfirm) {
        showMessage('All fields are required', 'danger');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('Passwords do not match', 'danger');
        return;
    }

    userPool.signUp(email, password, [], null, (err, result) => {
        if (err) {
            showMessage(err.message, 'danger');
            return;
        }
        showMessage('Signup successful! Please check your email for verification code.', 'success');
        setTimeout(() => showVerifyForm(email), 2000);
    });
}

function handleLogin() {
    if (!initCognito()) return;

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('Email and password are required', 'danger');
        return;
    }

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: email,
        Password: password
    });

    cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
    });

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
            const userId = result.idToken.payload.sub;
            localStorage.setItem('userId', userId);
            localStorage.setItem('idToken', result.idToken.jwtToken);
            window.location.href = 'dashboard.html';
        },
        onFailure: (err) => {
            showMessage(err.message, 'danger');
        }
    });
}

function handleLogout() {
    // Initialize userPool if not already done
    if (!userPool && typeof AmazonCognitoIdentity !== 'undefined') {
        const poolData = {
            UserPoolId: AWS_CONFIG.userPoolId,
            ClientId: AWS_CONFIG.clientId
        };
        userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    }

    if (userPool) {
        cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.signOut();
        }
    }

    // Clear local storage and redirect
    localStorage.removeItem('userId');
    localStorage.removeItem('idToken');
    window.location.href = 'index.html';
}

function handleVerify() {
    if (!initCognito()) return;

    const email = document.getElementById('verifyEmail').value;
    const code = document.getElementById('verifyCode').value;

    if (!email || !code) {
        showMessage('Email and verification code are required', 'danger');
        return;
    }

    const userData = {
        Username: email,
        Pool: userPool
    };

    cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
            showMessage(err.message, 'danger');
            return;
        }
        showMessage('Email verified successfully! You can now login.', 'success');
        setTimeout(() => showLogin(), 2000);
    });
}

// Initialize on page load
window.addEventListener('load', () => {
    if (window.location.pathname.includes('index.html')) {
        initCognito();
    }
});