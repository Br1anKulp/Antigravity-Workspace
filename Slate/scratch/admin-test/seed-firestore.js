const fs = require('fs');
const https = require('https');

// Load firebase-tools config
const configPath = 'C:/Users/brian/.config/configstore/firebase-tools.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Extract token
const tokens = config.tokens || {};
const accessToken = tokens.access_token;

if (!accessToken) {
  console.error("No access token found in firebase-tools.json tokens object");
  process.exit(1);
}

const emails = ['brian.k.kulp@gmail.com', 'familynflowers@protonmail.com'];

async function seed() {
  for (const email of emails) {
    await writeDoc(email);
  }
}

function writeDoc(email) {
  return new Promise((resolve) => {
    console.log(`Seeding allowedUsers/${email}...`);
    const docData = JSON.stringify({
      fields: {
        email: { stringValue: email },
        allowed: { booleanValue: true }
      }
    });

    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/kulpslate/databases/(default)/documents/allowedUsers/${encodeURIComponent(email)}`,
      method: 'PATCH', // PATCH with no updateMask will create/replace the doc
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(docData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const responseData = JSON.parse(body);
          if (responseData.error) {
            console.error(`Error writing ${email}:`, responseData.error);
          } else {
            console.log(`Successfully seeded ${email}!`);
          }
        } catch (err) {
          console.error(`JSON parse error for ${email}:`, err);
        }
        resolve();
      });
    });

    req.on('error', err => {
      console.error(`Request error for ${email}:`, err);
      resolve();
    });

    req.write(docData);
    req.end();
  });
}

seed();
