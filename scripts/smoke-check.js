#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { root: process.cwd(), siteUrl: 'https://your.site' };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && i + 1 < args.length) {
      options.root = args[i + 1];
      i++;
    } else if (args[i] === '--site-url' && i + 1 < args.length) {
      options.siteUrl = args[i + 1];
      i++;
    }
  }
  
  return options;
}

// Find all HTML files in the root directory
function findHtmlFiles(rootDir) {
  const htmlFiles = [];
  const files = fs.readdirSync(rootDir);
  
  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.html') {
      htmlFiles.push(path.join(rootDir, file));
    }
  }
  
  return htmlFiles;
}

// Simple HTML parser using regex (lightweight approach)
function parseHtml(content) {
  const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
  const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
  const viewportMatch = content.match(/<meta[^>]*name=["']viewport["']/i);
  const canonicalMatch = content.match(/<link[^>]*rel=["']canonical["']/i);
  const h1Matches = content.match(/<h1[^>]*>/gi) || [];
  const imgMatches = content.match(/<img[^>]*>/gi) || [];
  
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : null,
    hasViewport: !!viewportMatch,
    hasCanonical: !!canonicalMatch,
    h1Count: h1Matches.length,
    images: imgMatches
  };
}

// Check individual image for alt and loading attributes
function checkImage(imgTag) {
  const hasAlt = /alt=["'][^"']*["']/i.test(imgTag);
  const hasLoading = /loading=["']lazy["']/i.test(imgTag);
  const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
  const src = srcMatch ? srcMatch[1] : 'unknown';
  
  return {
    src,
    hasAlt,
    hasLoading
  };
}

// Validate a single HTML file
function validateHtmlFile(filePath, siteUrl) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseHtml(content);
  
  const errors = [];
  const warnings = [];
  
  // Check title length
  if (!parsed.title) {
    errors.push('Missing <title> tag');
  } else if (parsed.title.length < 10) {
    errors.push(`Title too short (${parsed.title.length} chars, minimum 10)`);
  }
  
  // Check description length
  if (!parsed.description) {
    errors.push('Missing meta description');
  } else if (parsed.description.length < 50) {
    errors.push(`Description too short (${parsed.description.length} chars, minimum 50)`);
  }
  
  // Check viewport
  if (!parsed.hasViewport) {
    errors.push('Missing viewport meta tag');
  }
  
  // Check canonical
  if (!parsed.hasCanonical) {
    errors.push('Missing canonical link tag');
  }
  
  // Check H1 tags
  if (parsed.h1Count === 0) {
    errors.push('Missing H1 tag');
  } else if (parsed.h1Count > 2) {
    warnings.push(`Multiple H1 tags found (${parsed.h1Count}), consider using only one primary H1`);
  }
  
  // Check images
  const missingAltImages = [];
  const missingLazyImages = [];
  
  for (const imgTag of parsed.images) {
    const imageInfo = checkImage(imgTag);
    if (!imageInfo.hasAlt) {
      missingAltImages.push(imageInfo.src);
    }
    if (!imageInfo.hasLoading) {
      missingLazyImages.push(imageInfo.src);
    }
  }
  
  if (missingAltImages.length > 0) {
    errors.push(`Images missing alt text: ${missingAltImages.join(', ')}`);
  }
  
  if (missingLazyImages.length > 0) {
    warnings.push(`Images missing loading="lazy": ${missingLazyImages.join(', ')}`);
  }
  
  return {
    file: path.basename(filePath),
    title: parsed.title,
    description: parsed.description,
    errors,
    warnings,
    stats: {
      titleLength: parsed.title ? parsed.title.length : 0,
      descriptionLength: parsed.description ? parsed.description.length : 0,
      h1Count: parsed.h1Count,
      imageCount: parsed.images.length,
      imagesWithAlt: parsed.images.length - missingAltImages.length,
      imagesWithLazy: parsed.images.length - missingLazyImages.length
    }
  };
}

// Main function
function main() {
  const options = parseArgs();
  const htmlFiles = findHtmlFiles(options.root);
  
  console.log('🔍 SEO Smoke Check Report');
  console.log('========================');
  console.log(`Root directory: ${options.root}`);
  console.log(`Site URL: ${options.siteUrl}`);
  console.log(`Found ${htmlFiles.length} HTML file(s)`);
  console.log('');
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const filePath of htmlFiles) {
    const result = validateHtmlFile(filePath, options.siteUrl);
    
    console.log(`📄 ${result.file}`);
    console.log(`   Title: "${result.title}" (${result.stats.titleLength} chars)`);
    console.log(`   Description: "${result.description}" (${result.stats.descriptionLength} chars)`);
    console.log(`   H1 tags: ${result.stats.h1Count}`);
    console.log(`   Images: ${result.stats.imageCount} total, ${result.stats.imagesWithAlt} with alt, ${result.stats.imagesWithLazy} with lazy loading`);
    
    if (result.errors.length > 0) {
      console.log('   ❌ Errors:');
      result.errors.forEach(error => console.log(`      - ${error}`));
      totalErrors += result.errors.length;
    }
    
    if (result.warnings.length > 0) {
      console.log('   ⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`      - ${warning}`));
      totalWarnings += result.warnings.length;
    }
    
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('   ✅ All checks passed');
    }
    
    console.log('');
  }
  
  console.log('Summary');
  console.log('=======');
  console.log(`Total files checked: ${htmlFiles.length}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);
  
  if (totalErrors === 0) {
    console.log('✅ All SEO checks passed!');
    process.exit(0);
  } else {
    console.log('❌ SEO checks failed. Please fix the errors above.');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
