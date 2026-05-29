const fs = require('fs');
const files = [
  'src/pages/courses/CourseManagement.tsx',
  'src/pages/courses/MyCourses.tsx',
  'src/pages/admin/QuranCircles.tsx',
  'src/pages/quran/MyQuranCircles.tsx'
];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const startIdx = lines.findIndex(line => line.includes('TabsContent value="sheet"'));
  if (startIdx !== -1) {
    let endIdx = startIdx + 1;
    let openTags = 1;
    while (endIdx < lines.length && openTags > 0) {
      if (lines[endIdx].includes('<TabsContent')) openTags++;
      if (lines[endIdx].includes('</TabsContent>')) openTags--;
      endIdx++;
    }
    console.log(`\n\n--- ${file} ---`);
    console.log(lines.slice(startIdx, endIdx).join('\n'));
  }
});
