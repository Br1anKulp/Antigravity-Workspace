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

queryFirestore(accessToken);

function queryFirestore(accessToken) {
  console.log("Querying Firestore for allowedUsers using direct access token...");
  const options = {
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/kulpslate/databases/(default)/documents/allowedUsers',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  const req2 = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const responseData = JSON.parse(body);
        if (responseData.error) {
          console.error("Firestore GET error:", responseData.error);
        } else {
          console.log("Documents in allowedUsers:");
          const docs = responseData.documents || [];
          if (docs.length === 0) {
            console.log("No documents found!");
          }
          docs.forEach(doc => {
            const name = doc.name.split('/').pop();
            console.log(`- ${name}:`, JSON.stringify(doc.fields));
          });
        }
      } catch (err) {
        console.error("JSON parse error:", err);
      }
    });
  });

  req2.on('error', err => console.error(err));
  req2.end();
}
