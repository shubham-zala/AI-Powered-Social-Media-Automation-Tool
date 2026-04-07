require('dotenv').config();
const { postToTwitter } = require('./services/twitter');

async function test() {
    console.log('--- Twitter Integration Test ---');

    // Test 1: Short Text
    console.log('\n--- Test 1: Short Text ---');
    const result1 = await postToTwitter("Test tweet from Social Media App - " + new Date().toISOString());
    console.log('Result:', JSON.stringify(result1, null, 2));

    // Test 2: Text + Media
    console.log('\n--- Test 2: Text + Media ---');
    const sampleImage = "https://picsum.photos/200/300.jpg";
    const result2 = await postToTwitter("Test tweet with image - " + new Date().toISOString(), sampleImage);
    console.log('Result:', JSON.stringify(result2, null, 2));
}

test();
