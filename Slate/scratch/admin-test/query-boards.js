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
  console.log("Querying Firestore for boards...");
  const options = {
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/kulpslate/databases/(default)/documents/boards',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const responseData = JSON.parse(body);
        if (responseData.error) {
          console.error("Firestore GET error:", responseData.error);
        } else {
          console.log("Documents in boards:");
          const docs = responseData.documents || [];
          if (docs.length === 0) {
            console.log("No documents found in boards collection!");
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

  req.on('error', err => console.error(err));
  req.end();
}
