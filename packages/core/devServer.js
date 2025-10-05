// dev-server.js - Serve the .well-known folder!
import express from 'express';
const app = express();

// Serve everything including hidden folders
app.use(express.static('.', {
  dotfiles: 'allow',  // ← Critical! Serves .well-known
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
  }
}));

app.listen(3000);
console.log('🔷 Bassline at http://localhost:3000');
console.log('✏️  Chrome DevTools can now edit your files directly!');