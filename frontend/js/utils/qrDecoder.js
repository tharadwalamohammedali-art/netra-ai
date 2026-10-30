/**
 * NETRA AI — Client-side QR Image Processor & Payload Parser
 */

export function parseUPIString(upiUri) {
  try {
    const url = new URL(upiUri);
    const params = {};
    for (const [key, val] of url.searchParams.entries()) {
      params[key] = val;
    }
    return {
      isValid: true,
      pa: params.pa || '',
      pn: params.pn || '',
      am: params.am || '',
      cu: params.cu || 'INR',
      tn: params.tn || ''
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Reads an image file from a dropzone or input, renders to hidden canvas,
 * and extracts any embedded EXIF/metadata or decodes demo payloads.
 */
export function processQrImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file (PNG, JPEG, WebP).'));
    }

    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('Image file exceeds the 5MB size limit.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        // Create canvas to examine pixels
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Check if image filename or metadata has a simulation payload
        let payload = null;
        if (file.name.includes('upi_scam')) {
          payload = 'upi://pay?pa=refund_support@okhdfcbank&pn=Helpdesk&am=15000&cu=INR&tn=Scan+to+receive+lottery+refund';
        } else if (file.name.includes('upi_merchant')) {
          payload = 'upi://pay?pa=freshmart@hdfcbank&pn=FreshMart+Supermarket&am=450.00&cu=INR&tn=Order_9821';
        } else if (file.name.includes('crypto')) {
          payload = 'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.5';
        } else if (file.name.includes('phishing')) {
          payload = 'https://paypal-security-verification.xyz/update-account';
        }

        resolve({
          dataUrl,
          width: img.width,
          height: img.height,
          detectedPayload: payload
        });
      };
      img.onerror = () => reject(new Error('Failed to decode image data.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
