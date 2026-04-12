import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.resolve('c:/aplicativos/gerenciaderede1/gerenciaderede/gerenciaderede/gerenciaderede/network-monitor/backend/google-credentials.json');

export const googleDriveService = {
  async uploadFile(localPath: string, folderId: string) {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error('Arquivo google-credentials.json não encontrado no backend.');
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const fileName = path.basename(localPath);

    console.log(`[DRIVE] Fazendo upload de ${fileName}...`);

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: fileName.endsWith('.rsc') ? 'text/plain' : 'application/octet-stream',
      body: fs.createReadStream(localPath),
    };

    try {
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });
      console.log(`[DRIVE] Upload concluído! ID: ${response.data.id}`);
      return response.data.id;
    } catch (error: any) {
      console.error('[DRIVE] Erro no upload:', error.message);
      throw error;
    }
  }
};
