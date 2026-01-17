import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const folderId = process.env.GOOGLE_FOLDER_ID;
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const counterPath = path.join(__dirname, 'counter.json');

let counter = [];
if (fs.existsSync(counterPath)) {
    try {
        const raw_data = fs.readFileSync(counterPath, 'utf-8');
        if (raw_data.length > 0) {
            const data = JSON.parse(raw_data);
            counter = data;
        }
    } catch {
        console.log('counter.json is invalid, resetting...');
    }
}

async function main() {
    const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'image/'`,
        fields: 'files(id, name)',
    });

    const allImages = res.data.files;
    const usedNames = counter.map((s) => s.filename);
    const unused = allImages.filter((img) => !usedNames.includes(img.name));

    if (unused.length === 0) {
        console.log('No unused images left. Stopping.');
        return;
    }

    const pick = unused[Math.floor(Math.random() * unused.length)];
    const dayNumber = counter.length + 118;

    // later when adding a record
    counter.push({ day: dayNumber, filename: pick.name });
    fs.writeFileSync(counterPath, JSON.stringify(counter, null, 2));

    await axios.post(webhookUrl, { content: `Weekly Mari posting #${dayNumber}` });

    const imgRes = await drive.files.get({ fileId: pick.id, alt: 'media' }, { responseType: 'arraybuffer' });
    const imageData = Buffer.from(imgRes.data, 'binary');

    const form = new FormData();
    form.append('file', imageData, pick.name);

    await axios.post(webhookUrl, form, { headers: form.getHeaders() });

    console.log(`Posted: ${pick.name}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
