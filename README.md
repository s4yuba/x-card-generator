# X Profile Name Tag Generator

A web-based tool that generates printable PDF name tags from X (Twitter) profile information. Simply input an X profile URL and get a professional name tag with the user's profile image, display name, username, and a QR code linking back to their profile.

## Features

- **Automatic Profile Extraction**: Extract username, display name, and profile image from X profile URLs
- **Professional Design**: Clean, readable name tag layout optimized for events and networking
- **QR Code Integration**: Back of name tag includes QR code for easy profile access
- **Print-Ready Output**: High-resolution PDF formatted for standard paper sizes
- **Error Handling**: Graceful handling of private profiles, network issues, and missing images
- **Default Fallbacks**: Uses placeholder images when profile images are unavailable

## How It Works

1. **Input**: Provide an X profile URL (e.g., `https://x.com/username`)
2. **Extract**: System scrapes profile data including name, username, and profile image
3. **Process**: Images are optimized and QR codes are generated
4. **Generate**: Creates a dual-sided PDF with front (profile info) and back (QR code)
5. **Download**: Receive print-ready PDF file

## Name Tag Layout

### Front Side
- Profile image (circular, optimized for printing)
- Display name (prominent, easy to read)
- Username (in @username format)
- Professional styling and typography

### Back Side
- QR code linking to the original X profile
- Optimized size for easy scanning
- Clean, minimal design

## Technical Stack

- **Backend**: Node.js with TypeScript
- **Web Scraping**: Puppeteer for JavaScript-rendered content
- **Image Processing**: Sharp for image optimization and resizing
- **QR Code Generation**: qrcode library for high-quality codes
- **PDF Generation**: PDFKit for print-ready documents
- **Web Interface**: Express.js with simple HTML frontend

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd x-profile-name-tag-generator

# Install dependencies
npm install

# Build the project
npm run build

# Start the development server
npm run dev
```

## Usage

### Web Interface
1. Open your browser and navigate to `http://localhost:3000`
2. Enter an X profile URL in the input field
3. Click "Generate Name Tag"
4. Download the generated PDF file
5. Print on standard paper or card stock

### API Endpoint
```bash
# Generate name tag via API
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"profileUrl": "https://x.com/username"}'
```

## Configuration

### Environment Variables
```bash
# Server configuration
PORT=3000
NODE_ENV=development

# Browser configuration (optional)
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000

# PDF configuration (optional)
PDF_DPI=300
NAME_TAG_WIDTH=252  # 3.5 inches in points
NAME_TAG_HEIGHT=162 # 2.25 inches in points
```

### Name Tag Customization
The name tag design can be customized by modifying the configuration in `src/config/nameTagConfig.ts`:

```typescript
export const nameTagConfig = {
  dimensions: {
    width: 252,  // 3.5 inches
    height: 162  // 2.25 inches
  },
  fonts: {
    displayName: { size: 24, weight: 'bold' },
    username: { size: 16, weight: 'normal' }
  },
  colors: {
    background: '#ffffff',
    text: '#000000',
    accent: '#1da1f2'
  }
};
```

## Error Handling

The system handles various error scenarios gracefully:

- **Invalid URLs**: Clear error messages with format examples
- **Private Profiles**: Informative messages about accessibility
- **Network Issues**: Retry logic with exponential backoff
- **Missing Images**: Automatic fallback to default placeholder
- **PDF Generation Errors**: Detailed error reporting and recovery suggestions

## Development

### Project Structure
```
src/
├── components/          # Core modules
│   ├── profileScraper/  # X profile data extraction
│   ├── imageProcessor/  # Image download and optimization
│   ├── qrGenerator/     # QR code creation
│   └── pdfGenerator/    # PDF document creation
├── api/                 # Express.js routes and middleware
├── config/              # Configuration files
├── utils/               # Utility functions
└── types/               # TypeScript type definitions

tests/
├── unit/                # Unit tests for individual modules
├── integration/         # End-to-end workflow tests
└── fixtures/            # Test data and mock responses
```

### Available Scripts
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build production version
npm run test         # Run test suite
npm run test:unit    # Run unit tests only
npm run test:integration # Run integration tests only
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- profileScraper.test.ts
```

## Deployment

### Docker
```bash
# Build Docker image
docker build -t x-profile-name-tag-generator .

# Run container
docker run -p 3000:3000 x-profile-name-tag-generator
```

### Production Considerations
- Use process manager (PM2) for Node.js applications
- Configure reverse proxy (nginx) for production traffic
- Set up monitoring and logging
- Implement rate limiting for API endpoints
- Use HTTPS for secure data transmission

## Limitations

- **Rate Limiting**: Respects X's servers with appropriate request delays
- **Public Profiles Only**: Cannot access private or protected profiles
- **Image Dependencies**: Requires profile images to be publicly accessible
- **Browser Requirements**: Needs headless browser for JavaScript rendering

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new functionality
- Update documentation for API changes
- Use conventional commit messages
- Ensure code passes linting and type checking

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for event organizers and networking professionals
- Inspired by the need for quick, professional name tag creation
- Uses respectful web scraping practices

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation
- Review the troubleshooting section below

## Troubleshooting

### Common Issues

**"Profile not found" error**
- Verify the X profile URL is correct and publicly accessible
- Check if the profile exists and is not private

**"Image processing failed" error**
- The system will use a default placeholder image
- Ensure stable internet connection for image downloads

**PDF generation issues**
- Check available disk space and memory
- Verify all dependencies are properly installed

**Browser/Puppeteer errors**
- Ensure Chrome/Chromium is available on the system
- Check if running in a containerized environment with proper configuration