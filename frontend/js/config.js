// AWS Configuration
const AWS_CONFIG = {
    region: 'ap-south-1', // Change to your region
    userPoolId: 'ap-south-1_JGN9lrlC3', // Replace with your User Pool ID
    clientId: '5lma0b40ueu3ro46j7vm83h77h', // Replace with your Client ID
    identityPoolId: '', // Replace with your Identity Pool ID (optional)
    apiGatewayUrl: 'https://gjnavvdij0.execute-api.ap-south-1.amazonaws.com/dev' // Replace with your API Gateway endpoint
};

// Validate config before proceeding
function validateConfig() {
    const requiredFields = ['userPoolId', 'clientId', 'apiGatewayUrl'];
    const missingFields = requiredFields.filter(field => 
        AWS_CONFIG[field].includes('YOUR_')
    );
    
    if (missingFields.length > 0) {
        console.warn(`Missing AWS config: ${missingFields.join(', ')}`);
    }
}

validateConfig();