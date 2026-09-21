const http = require('http');

async function testFetch() {
    // Check if localhost:4004 is currently listening from the user's running dev server
    const req = http.request({
        hostname: 'localhost',
        port: 4004,
        path: '/api/cnma/EIGHTD_SRV/Reports?$select=ID,notificationId&$expand=disciplines($select=code,reviewStatus)',
        method: 'GET',
        headers: {
            'Authorization': 'Basic ' + Buffer.from('admin:').toString('base64'),
            'Accept': 'application/json'
        }
    }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Status code:', res.statusCode);
            console.log('Response body:', data);
        });
    });

    req.on('error', err => {
        console.error('Request error:', err.message);
    });

    req.end();
}

testFetch();
