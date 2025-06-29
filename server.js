// server.js - A secure back-end to handle MoneyMotion.io payments

// IMPORTANT: In a real production environment, you must install these packages.
// Run `npm install express node-fetch cors` in your server's terminal.
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================================================
// !!! CRITICAL SECURITY WARNING !!!
//
// Do NOT paste your secret API key directly into this file.
// Use environment variables to keep it secure.
// On your hosting service (like Heroku or Vercel), you will add a
// configuration variable named MONEYMOTION_API_KEY and set its value to the
// secret key you got from MoneyMotion.io.
// ==============================================================================
const MONEYMOTION_API_KEY = process.env.MONEYMOTION_API_KEY;

// ==============================================================================
// --- FIX FOR "FAILED TO FETCH" ERROR ---
// The `cors` middleware needs to run before any of your routes.
// This tells the browser that your server will accept requests from other domains.
app.use(cors()); 
// ==============================================================================

// This middleware is needed to parse JSON bodies from incoming requests
app.use(express.json());

// A simple "health check" route to verify the server is running
app.get('/', (req, res) => {
    res.send('NextLevelCheats server is running correctly.');
});


// This is the endpoint your website will call when a user wants to pay
app.post('/create-payment', async (req, res) => {
    // Check if the secret key is configured on the server
    if (!MONEYMOTION_API_KEY) {
        console.error("MoneyMotion API key is not configured on the server.");
        return res.status(500).json({ error: "Payment processing is not configured." });
    }

    const { amount, username } = req.body;

    // Validate the data from the front-end
    if (!amount || amount < 1 || !username) {
        return res.status(400).json({ error: 'Invalid amount or user information.' });
    }

    // MoneyMotion.io requires the amount in cents (e.g., $5.00 = 500)
    const amountInCents = Math.round(amount * 100);

    // The body of the request to send to MoneyMotion.io's API
    // NOTE: The structure of this object is an assumption based on common payment
    // processors. You MUST check the official MoneyMotion.io API documentation
    // for the correct field names and structure.
    const paymentRequestBody = {
        amount: amountInCents,
        currency: 'usd', // Assuming USD, change if necessary
        success_url: 'https://your-website-url.com/payment-success', // The page to show on success
        cancel_url: 'https://your-website-url.com/payment-cancelled', // The page to show on cancellation
        metadata: {
            // Send the username so you know who made the payment
            username: username 
        },
        // Other fields as required by MoneyMotion.io
    };

    try {
        // Make the secure, server-to-server API call to MoneyMotion.io
        const response = await fetch('https://api.moneymotion.io/v1/checkout/sessions', { // This URL is an example, check docs
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MONEYMOTION_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentRequestBody)
        });

        const paymentSession = await response.json();

        if (!response.ok) {
            // If MoneyMotion returns an error, log it on the server and send a generic error back
            console.error("MoneyMotion API Error:", paymentSession);
            throw new Error('Failed to create payment session with provider.');
        }

        // Send the payment URL back to your front-end
        res.json({ paymentUrl: paymentSession.url });

    } catch (error) {
        console.error("Server error creating payment:", error);
        res.status(500).json({ error: 'Could not create payment session.' });
    }
});


// This is the webhook endpoint MoneyMotion.io will call *after* a payment is successful.
// You must configure this URL in your MoneyMotion.io dashboard.
app.post('/moneymotion-webhook', (req, res) => {
    const event = req.body;

    // TODO: Add security check to verify the webhook request actually came from MoneyMotion.io

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const username = session.metadata.username;
        const amountPaid = session.amount_total / 100; // Convert from cents back to dollars

        console.log(`Payment successful for user: ${username}, Amount: $${amountPaid}`);

        // TODO:
        // 1. Find the user in your database (or localStorage for this example).
        // 2. Add `amountPaid` to their funds.
        // 3. Save the updated user data.
    }
    
    // Respond to MoneyMotion to acknowledge receipt of the event
    res.status(200).send();
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
