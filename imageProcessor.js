import { auth } from "@canva/user";
import * as tf from '@tensorflow/tfjs';  // needs to be installed
import * as bodyPix from '@tensorflow-models/body-pix'; // needs to be installed
import { getTemporaryUrl } from "@canva/asset";

const imageProcessor = async (action, userPrompt, selectedImageUrl, shape, userText, fontFamily, textEffect, letterSpacing, lineSpacing, borderColor) => {
  const BACKEND_URL = `${BACKEND_HOST}/gemini-route`; 

  console.log('Parameters imageProcessor: ', action, userPrompt, selectedImageUrl, shape, userText, fontFamily, textEffect, letterSpacing, lineSpacing, borderColor);

  try {
      const token = await auth.getCanvaUserToken();
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, userPrompt, selectedImageUrl }), // Use the Base64 version
      });

      console.log('server response: ', res);
      
      const body = await res.json();
      console.log('selectedImageUrl:', selectedImageUrl);

      if (body.image) {
        console.log('Image data:', body.image);
        // Do something with the image, e.g., display it on the webpage
    } else {
        console.error('Unexpected response format', body);
    }


      console.log('AI body', body);
      console.log('AI generated URL - imageProcessor', body.image);


      async function loadAndDrawImage(url, ctx) {
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const imageBlob = await response.blob();
            const imageUrl = URL.createObjectURL(imageBlob);
    
            const img = new Image();
            img.src = imageUrl;
    
            img.onload = () => {
                ctx.drawImage(img, 0, 0, 1024, 1024);
                URL.revokeObjectURL(imageUrl);
                console.log('Image loaded and drawn.');
            };
    
            img.onerror = () => {
                console.error('Error loading image');
            };
        } catch (error) {
            console.error('Error in loadAndDrawImage:', error);
        }
    }
    


    const loadImage = (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.crossOrigin = 'Anonymous';
        img.src = src;
      });
    };

    const resizeImage = (image, width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    };

    const removeBackgroundFromImage = async (canvas) => {
      const net = await bodyPix.load({
        architecture: 'ResNet50',
        outputStride: 32,
        quantBytes: 4,
      });
      const segmentation = await net.segmentPerson(canvas, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7,
        scoreThreshold: 0.7,
      });

      const ctx = canvas.getContext('2d');
      const { data: imgData } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const newImg = ctx.createImageData(canvas.width, canvas.height);
      const newImgData = newImg.data;

      segmentation.data.forEach((segment, i) => {
        if (segment == 1) {
          newImgData[i * 4] = imgData[i * 4];
          newImgData[i * 4 + 1] = imgData[i * 4 + 1];
          newImgData[i * 4 + 2] = imgData[i * 4 + 2];
          newImgData[i * 4 + 3] = imgData[i * 4 + 3];
        }
      });

      ctx.putImageData(newImg, 0, 0);
      return canvas;
    };

    const blobToImage = (blob) => {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    const dataURLToBlob = (dataURL) => {
      const binary = atob(dataURL.split(',')[1]);
      const array = [];
      for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
      }
      return new Blob([new Uint8Array(array)], { type: 'image/jpeg' });
    };

    const getShapePathFrame = (shape) => {
      switch (shape) {
        case 'heart':
          return "M512,182 C347,17 72,127 72,402 C72,677 512,1007 512,1007 C512,1007 952,677 952,402 C952,127 677,17 512,182"
        case 'circle':
          return "M 512 50 A 486.4 486.4 0 1 1 511.99 50";
        case 'triangle':
          return "M 512 62 L 0 741 L 1024 741 Z";
        case 'cross':
            return "M398 102 V398 H102 V626 H398 V922 H626 V626 H922 V398 H626 V102 Z";

        case 'star':
              return "M512,-0.9759 L602.3,380.5311 L1028.96,359.9301 L717.362,563.2401 L835.07,992.5581 L512,728.4531 L188.93,992.5581 L306.638,563.2401 L-4.96,359.9301 L421.7,380.5311 ";
  
        case 'pentagon':
            return "M920.1445651649736,808.2437680794063 L356.65543483502663,991.3324842127572 L8.4,512 L356.6554348350264,32.66751578724263 L920.1445651649734,215.75623284459345 Z";

        case 'octagon':
            return "M992.25,710.426375 L711.155,991.812375 L313.828,991.812375 L32.686,710.426375 L32.686,312.936375 L313.992,31.794375 L711.155,31.794375 L992.25,313.100375 Z";
       
        case 'decaton':
              return "M992,512 L896.5304,806.768 L646.5896,991.2296 L377.4104,991.2296 L127.4696,806.768 L32,512 L127.4696,217.232 L377.4104,32.7704 L646.5896,32.7704 L896.5304,217.232 Z";
        
        case 'rhombus':
              return "M512,3.18 L897.32,512 L512,1020.82 L126.68,512 Z";
        default:
          return "";
      }
    };

    // Main processing logic
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    let backgroundImagePath = body.image;

    if (['change background', 'add shaped frame', 'image variation', 'add picture frame', 'add border'].includes(action)) {
      const foregroundImg = await loadImage(selectedImageUrl);
      console.log('Foreground image loaded.');

      let resizedForegroundImg;

      if (['change background', 'add shaped frame', 'image variation'].includes(action)) {
        resizedForegroundImg = resizeImage(foregroundImg, 1024, 1024); // Desired width and height
      } else if (action === 'add picture frame') {
        resizedForegroundImg = resizeImage(foregroundImg, 482, 486);
      } else if (action === 'add border') {
        resizedForegroundImg = resizeImage(foregroundImg, 820, 868);
      }
      console.log('Foreground resize done');

      if (action === 'change background') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1024;
        tempCanvas.height = 1024;
        const tempCtx = tempCanvas.getContext('2d');
        const tempImage = await loadImage(resizedForegroundImg);
        tempCtx.drawImage(tempImage, 0, 0, 1024, 1024);
        const processedForegroundCanvas = await removeBackgroundFromImage(tempCanvas);

        console.log('Foreground image background removed.');
        const processedForeground = await blobToImage(dataURLToBlob(processedForegroundCanvas.toDataURL('image/png')));

        const backgroundImg = await loadImage(backgroundImagePath);
        console.log('Background image loaded.');

        ctx.drawImage(backgroundImg, 0, 0, 1024, 1024);
        ctx.drawImage(processedForeground, 0, 0, 1024, 1024);

        const finalImageUrl = canvas.toDataURL('image/png');
        console.log('Final image processed.');
        return finalImageUrl;

      } else if (['add border'].includes(action)) {
        const backgroundImg = await loadImage(backgroundImagePath);
        console.log('Background image loaded.');

        const centeredForeground = await blobToImage(dataURLToBlob(resizedForegroundImg));
        ctx.drawImage(backgroundImg, 0, 0, 1024, 1024);

        let foregroundWidth;
        let foregroundHeight;

        if (action === 'add picture frame') {
          foregroundWidth = 482;
          foregroundHeight = 486;
        } else if (action === 'add border') {
          foregroundWidth = 820;
          foregroundHeight = 868;
        }

        ctx.drawImage(centeredForeground, (1024 - foregroundWidth) / 2, (1024 - foregroundHeight) / 2, foregroundWidth, foregroundHeight); 

        const finalImageUrl = canvas.toDataURL('image/png');
        console.log('Final image processed.');
        return finalImageUrl;

      } else if (['add picture frame'].includes(action)) {
        const frameImage = await loadImage(backgroundImagePath);
        const foregroundImg = await loadImage(selectedImageUrl);
        console.log('Foreground and frame images loaded.');
  
        // Get the frame's natural dimensions
        const frameWidth = frameImage.naturalWidth;
        const frameHeight = frameImage.naturalHeight;
        
        // Set canvas dimensions to match the frame
        canvas.width = frameWidth;
        canvas.height = frameHeight;
  
        // Manually set the dimensions of the inner square (adjust as necessary)
        const innerWidth = frameWidth * 0.6;
        const innerHeight = frameHeight * 0.6;
  
        // Draw the frame onto the canvas
        ctx.drawImage(frameImage, 0, 0, frameWidth, frameHeight);
  
        // Resize the image to fit within the frame's inner square
        const scaleFactor = Math.min(innerWidth / foregroundImg.naturalWidth, innerHeight / foregroundImg.naturalHeight);
        const imgWidth = foregroundImg.naturalWidth * scaleFactor;
        const imgHeight = foregroundImg.naturalHeight * scaleFactor;
  
        // Center the image within the inner square
        const xOffset = (frameWidth - imgWidth) / 2;
        const yOffset = (frameHeight - imgHeight) / 2;
  
        // Draw the image onto the canvas in the correct position
        ctx.drawImage(foregroundImg, xOffset, yOffset, imgWidth, imgHeight);
  
        const finalImageUrl = canvas.toDataURL('image/png');
        console.log('Final image processed.');
        return finalImageUrl;

      } else if (action === 'add shaped frame') {

      //await loadAndDrawImage(imageUrlb, ctxc);

        backgroundImagePath = body.image;
        console.log('Background image loaded.');
  
        const shapePath = getShapePathFrame(shape);

  
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
          <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" />
          <defs>
            <mask id="customMask">
              <rect x="0" y="0" width="1024" height="1024" fill="black" />
              <path d="${shapePath}" fill="white" /> 
            </mask>
          </defs>
          <image x="0" y="0" width="1024" height="1024" href="${resizedForegroundImg}" mask="url(#customMask)" />
        </svg>`;
  
        const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);
  
        const svgImage = await loadImage(svgUrl);
        ctx.drawImage(svgImage, 0, 0, 1024, 1024);
        URL.revokeObjectURL(svgUrl);
        console.log('Foreground image resized and transparent shape added.');
  
        const finalImageUrl = canvas.toDataURL('image/png');
        console.log('Final image processed.');
  
        return finalImageUrl;
  
        
      }
    }

    if (action === 'generate transparent shape') {

      backgroundImagePath = body.image;
      console.log('Background image loaded.');

      const shapePath = getShapePathFrame(shape);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <mask id="customMask">
            <rect x="0" y="0" width="1024" height="1024" fill="white" /> <!-- Make the entire area visible -->
            <path d="${shapePath}" fill="black" /> <!-- Make the shape area transparent -->
          </mask>
        </defs>
        <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" mask="url(#customMask)" />
      </svg>`;
      
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      const svgImage = await loadImage(svgUrl);
      ctx.drawImage(svgImage, 0, 0, 1024, 1024);
      URL.revokeObjectURL(svgUrl);
      
      const finalImageUrl = canvas.toDataURL('image/png');
      console.log('Final image processed.');
      
      return finalImageUrl;
      
    }

    if (action === 'generate shaped image') {
      const shapePath = getShapePathFrame(shape);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <mask id="customMask">
            <rect x="0" y="0" width="1024" height="1024" fill="black" />
            <path d="${shapePath}" fill="white" /> 
          </mask>
        </defs>
        <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" mask="url(#customMask)" />
      </svg>`;

      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const svgImage = await loadImage(svgUrl);
      ctx.drawImage(svgImage, 0, 0, 1024, 1024);
      URL.revokeObjectURL(svgUrl);

      const finalImageUrl = canvas.toDataURL('image/png');
      console.log('Final image processed.');

      return finalImageUrl;
    }

    if (action === 'text frame') {

      backgroundImagePath = body.image;
      const lines = userText.split('\n'); // Split the text into lines based on the newline character
      //const lineSpacing = 1.1; // Line height multiplier for spacing between lines
      const fontSize = 300; // Font size in pixels
      const initialYPosition = 512; // Centered vertically
      let svg;
    
      //borderFlag, dddFlag, haloFlag,

      if (textEffect === 'noBorder') {
       // Calculate the total height of the text block
      const textBlockHeight = (lines.length - 1) * fontSize * lineSpacing + fontSize;
      
      // Centering adjustments
      const initialYPosition = (1024 - textBlockHeight) / 2 + fontSize / 2; // Center vertically
      

    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <clipPath id="clip">
          ${lines.map((line, index) => `
            <text x="50%" y="${initialYPosition + index * fontSize * lineSpacing}"  font-family="${fontFamily}" font-size="${fontSize}" font-weight="900" dominant-baseline="middle" text-anchor="middle">${line}</text>
           `).join('')}
            </clipPath>
          <filter id="distortion">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="20" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <image x="0" y="0"  href="${backgroundImagePath}" width="1024" height="1024" clip-path="url(#clip)" filter="url(#distortion)"></image>
      </svg>`;



     }if (textEffect === 'borderFlag') {

      const textBlockHeight = (lines.length - 1) * fontSize * lineSpacing + fontSize;
      const initialYPosition = (1024 - textBlockHeight) / 2 + fontSize / 2; // Center vertically

       svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <mask id="text-mask">
            <rect width="1024" height="1024" fill="black"/>
            ${lines.map((line, index) => `
              <text 
                x="50%" 
                y="${initialYPosition + index * fontSize * lineSpacing}" 
                font-size="${fontSize}" 
                font-family="${fontFamily}" 
                text-anchor="middle" 
                dominant-baseline="middle"
                fill="white" 
                font-weight="900" 
                stroke-width="6">${line}</text>
            `).join('')}
          </mask>
        </defs>
        <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" mask="url(#text-mask)" />
        ${lines.map((line, index) => `
          <text 
            x="50%" 
            y="${initialYPosition + index * fontSize * lineSpacing}" 
            font-size="${fontSize}" 
            font-family="${fontFamily}" 
            text-anchor="middle" 
            dominant-baseline="middle"
            fill="none" 
            font-weight="900" 
            stroke-width="4">${line}</text>
          <text 
            x="50%" 
            y="${initialYPosition + index * fontSize * lineSpacing}" 
            font-size="${fontSize}" 
            font-family="${fontFamily}" 
            text-anchor="middle" 
            dominant-baseline="middle"
            fill="none" 
             font-weight="900" 
            stroke-width="2">${line}</text>
          <text 
            x="50%" 
            y="${initialYPosition + index * fontSize * lineSpacing}" 
            font-size="${fontSize}" 
            font-family="${fontFamily}" 
            text-anchor="middle" 
            dominant-baseline="middle"
            fill="none" 
            font-weight="900" 
            stroke="${borderColor}" 
            stroke-width="1">${line}</text>
        `).join('')}
      </svg>`;


     }if (textEffect === 'dddFlag1') {
        const fontSizeB = 310; // Font size in pixels
       // const initialYPosition = 512; // Centered vertically

         svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
          <defs>
            <filter id="text-outline">
              <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="DILATED"/>
              <feFlood flood-color="${borderColor}" result="COLOR"/>
              <feComposite in="COLOR" in2="DILATED" operator="in" result="OUTLINE"/>
              <feMerge>
                <feMergeNode in="OUTLINE"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <!-- Define a mask to clip the image to the thicker text -->
            <mask id="text-mask">
              ${lines.map((line, index) => 
                `<text 
                  x="50%" 
                  y="${initialYPosition + (index - lines.length / 2) * fontSize * lineSpacing}" 
                  font-size="${fontSize}" 
                  dy=".3em" 
                  font-family="${fontFamily}" 
                  text-anchor="middle" 
                  dominant-baseline="middle"
                  fill="white" 
                  stroke="white" 
                  font-weight="900" 
                  stroke-width="20">${line}</text>`  
              ).join('')}
            </mask>
          </defs>

          <!-- Background image visible through the text -->
          <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" mask="url(#text-mask)" />

          <!-- Blue outline around the text -->
          ${lines.map((line, index) => 
            `<text 
              x="50%" 
              y="${initialYPosition + (index - lines.length / 2) * fontSizeB * lineSpacing}" 
              font-size="${fontSizeB}" 
              dy=".3em" 
              font-family="${fontFamily}" 
              text-anchor="middle" 
              dominant-baseline="middle"
              fill="none" 
              stroke="${borderColor}" 
              stroke-width="1" 
              font-weight="900" 
              letter-spacing="${letterSpacing}px"
              filter="url(#text-outline)">${line}</text>`
          ).join('')}
        </svg>`;


     } if (textEffect === 'haloFlag') {

      //const initialYPosition = 512; // Starting Y position percentage (centered vertically)

      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <mask id="text-mask">
            <rect width="1024" height="1024" fill="black"/>
            ${lines.map((line, index) => 
              `<text 
                x="50%" 
                y="${initialYPosition + (index - lines.length / 2) * fontSize * lineSpacing}" 
                font-size="${fontSize}" 
                dy=".3em" 
                font-family="${fontFamily}" 
                text-anchor="middle" 
                dominant-baseline="middle"
                fill="white" 
                font-weight="900" 
                stroke="#00bf63" 
                stroke-width="10" 
                letter-spacing="${letterSpacing}px">${line}</text>`
            ).join('')}
          </mask>
        </defs>
        <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" mask="url(#text-mask)" />
      </svg>`;



     } if (textEffect === 'dddFlag2') {

            // Calculate the total height of the text block
            const textBlockHeight = (lines.length - 1) * fontSize * lineSpacing + fontSize;
            const fontSizeB = 305; // Font size in pixels
      
            // Centering adjustments
            const initialYPosition = (1024 - textBlockHeight) / 2 + fontSize / 2; // Center vertically

       svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
        <defs>
          <filter id="text-outline">
            <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="DILATED"/>
            <feFlood flood-color="white" result="COLOR"/>
            <feComposite in="COLOR" in2="DILATED" operator="in" result="OUTLINE"/>
            <feMerge>
              <feMergeNode in="OUTLINE"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <mask id="text-mask">
            ${lines.map((line, index) => 
              `<text 
                x="50%" 
                y="${initialYPosition + (index - lines.length / 2) * fontSize * lineSpacing}" 
                font-size="${fontSize}" 
                font-weight="900" 
                dy=".3em" 
                font-family="${fontFamily}" 
                text-anchor="middle" 
                stroke-width="70" 
                letter-spacing="${letterSpacing}px"
                dominant-baseline="middle"
                fill="white">${line}</text>`
            ).join('')}
          </mask>
        </defs>

        <!-- Background image visible through the text -->
        <image x="0" y="0" width="1024" height="1024" href="${backgroundImagePath}" mask="url(#text-mask)" />

        <!-- Blue outline around the text -->
        ${lines.map((line, index) => 
          `<text 
            x="50%" 
            y="${initialYPosition + (index - lines.length / 2) * fontSize * lineSpacing}" 
            font-size="${fontSizeB}" 
            dy=".3em" 
            font-family="${fontFamily}" 
            text-anchor="middle" 
            dominant-baseline="middle"
            fill="none" 
            stroke="${borderColor}" 
            stroke-width="4" 
            letter-spacing="${letterSpacing}px"
            filter="url(#text-outline)">${line}</text>`
        ).join('')}
      </svg>`;

    } if (textEffect === 'transparentFlag') {

      const textBlockHeight = (lines.length - 1) * fontSize * lineSpacing + fontSize;
      const initialYPosition = (1024 - textBlockHeight) / 2 + fontSize / 2; // Center vertically
  
      svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <defs>
          <clipPath id="clip">
            ${lines.map((line, index) => `
              <text x="50%" y="${initialYPosition + index * fontSize * lineSpacing}" 
                    font-family="${fontFamily}" font-size="${fontSize}" font-weight="900" 
                    dominant-baseline="middle" text-anchor="middle">${line}</text>
            `).join('')}
          </clipPath>
  
          <filter id="distortion">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence"/>
            <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="20" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
  
          <filter id="textFilter">
            <feMorphology operator="dilate" radius="4" in="SourceAlpha" result="dark_edge_01" />
            <feOffset dx="5" dy="5" in="dark_edge_01" result="dark_edge_03"/>
            <feFlood flood-color="rgba(0,0,0,.5)" result="dark_edge_04" />
            <feComposite in="dark_edge_04" in2="dark_edge_03" operator="in" result="dark_edge" />
  
            <feMorphology operator="dilate" radius="4" in="SourceAlpha" result="light_edge_01" />
            <feOffset dx="-2" dy="-2" in="light_edge_01" result="light_edge_03"/>
            <feFlood flood-color="rgba(255,255,255,.5)" result="light_edge_04" />
            <feComposite in="light_edge_04" in2="light_edge_03" operator="in" result="light_edge" />
  
            <feMerge result="edges">
              <feMergeNode in="dark_edge" />
              <feMergeNode in="light_edge" />
            </feMerge>
            <feComposite in="edges" in2="SourceGraphic" operator="out" result="edges_complete" />
  
            <feGaussianBlur stdDeviation="5" result="bevel_blur" />
            <feSpecularLighting result="bevel_lighting" in="bevel_blur" specularConstant="2.4" specularExponent="13" lighting-color="rgba(60,60,60,.4)">
              <feDistantLight azimuth="25" elevation="40" />
            </feSpecularLighting>
            <feComposite in="bevel_lighting" in2="SourceGraphic" operator="in" result="bevel_complete" />
  
            <feMerge result="complete">
              <feMergeNode in="edges_complete" />
              <feMergeNode in="bevel_complete" />
            </feMerge>
          </filter>
        </defs>
  
        <image href="${backgroundImagePath}" width="1024" height="1024" x="0" y="0" />
        <image href="${backgroundImagePath}" width="1024" height="1024" x="0" y="0" clip-path="url(#clip)" filter="url(#distortion)" />
        ${lines.map((line, index) => `
          <text x="50%" y="${initialYPosition + index * fontSize * lineSpacing}" 
                font-family="${fontFamily}" font-size="${fontSize}" font-weight="900"
                dominant-baseline="middle" text-anchor="middle" filter="url(#textFilter)" fill="white">${line}</text>
        `).join('')}
      </svg>`;
  
    }
      try {
          const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
          const svgUrl = URL.createObjectURL(svgBlob);
          const svgImage = await loadImage(svgUrl);
          ctx.drawImage(svgImage, 0, 0, 1024, 1024);
          URL.revokeObjectURL(svgUrl);

          const finalImageUrl = canvas.toDataURL('image/png');

          console.log('Final image processed.');
          console.log('Image loaded successfully');
          return finalImageUrl;

      } catch (error) {
          console.error('Failed to load image:', error);
      }
      

    }

    if (action === 'generate background' || action === 'image variation') { 
      
      const finalImageUrl = body.image;
      return finalImageUrl;

    }

  } catch (error) {
    console.error('Error processing image:', error);
    return null;
  }
};

export default imageProcessor;
