import { auth } from "@canva/user";

export async function generateImagePanel(action, userPrompt) {


const BACKEND_URL = `${BACKEND_HOST}/gemini-route`; 

const token = await auth.getCanvaUserToken();
const res = await fetch(BACKEND_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ action, userPrompt}),
});
const body = await res.json();
let backgroundImagePath = body.image;

console.log('AI body', body);
console.log('AI generated URL - imageProcessor', body.image);

  const canvas = document.createElement('canvas');
  canvas.width = 1024; 
  canvas.height = 1024; 
  const ctx = canvas.getContext('2d');

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; 
    img.src = backgroundImagePath;

    img.onload = () => {
      const panelWidth = canvas.width / 3; 
      const panelHeight = canvas.height;

      // Calculate coordinates for each panel
      const leftPanelX = 0;
      const centerPanelX = panelWidth;
      const rightPanelX = 2 * panelWidth;

      // Left Panel
      ctx.save();
      ctx.translate(leftPanelX + panelWidth / 2, panelHeight / 2);
      ctx.rotate(-0.2); 
      ctx.translate(-panelWidth / 2, -panelHeight / 2);
      ctx.drawImage(img, 0, 0, img.width / 3, img.height, 0, 0, panelWidth, panelHeight);
      ctx.restore();

      // Center Panel
      ctx.save();
      ctx.translate(centerPanelX + panelWidth / 2, panelHeight / 2);
      ctx.rotate(0); 
      ctx.translate(-panelWidth / 2, -panelHeight / 2);
      ctx.drawImage(img, img.width / 3, 0, img.width / 3, img.height, 0, 0, panelWidth, panelHeight);
      ctx.restore();

      // Right Panel
      ctx.save();
      ctx.translate(rightPanelX + panelWidth / 2, panelHeight / 2);
      ctx.rotate(0.2); 
      ctx.translate(-panelWidth / 2, -panelHeight / 2);
      ctx.drawImage(img, 2 * (img.width / 3), 0, img.width / 3, img.height, 0, 0, panelWidth, panelHeight);
      ctx.restore();

      // Adding Shadows for Depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(panelWidth - 5, 0, 10, panelHeight);
      ctx.fillRect(2 * panelWidth - 5, 0, 10, panelHeight);

      // Convert the canvas to a data URL and resolve the promise
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    };

    img.onerror = (error) => {
      reject(error);
    };
  });
}

export default generateImagePanel;
