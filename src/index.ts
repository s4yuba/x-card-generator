import express from 'express';
import { NameTagGenerator } from './services/NameTagGenerator';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const nameTagGenerator = new NameTagGenerator();

app.post('/api/generate', async (req, res) => {
  try {
    const { profileUrl } = req.body;
    
    if (!profileUrl) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'MISSING_URL', 
          message: 'Profile URL is required' 
        } 
      });
    }

    const pdfBuffer = await nameTagGenerator.generateNameTag(profileUrl);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="name-tag.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating name tag:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'GENERATION_FAILED', 
        message: 'Failed to generate name tag' 
      } 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});