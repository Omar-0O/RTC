const fs = require('fs');
let content = fs.readFileSync('src/pages/courses/CourseManagement.tsx', 'utf8');

// 1. Grid replacements
content = content.replace(/className="grid grid-cols-2/g, 'className="grid grid-cols-1 sm:grid-cols-2');

// 2. Table wrap
// Find <Table> not already wrapped and wrap it
content = content.replace(/(?<!<div className="overflow-x-auto(?: w-full)?">\s*)<Table(?:>| className)/g, '<div className="overflow-x-auto w-full">\n<Table$&'.replace('$&', ''));
content = content.replace(/<\/Table>/g, '<\/Table>\n<\/div>');

// 3. Popovers
content = content.replace(/w-\[400px\]/g, 'w-[calc(100vw-2.5rem)] sm:w-[400px]');
content = content.replace(/w-80/g, 'w-[calc(100vw-2.5rem)] sm:w-80');
content = content.replace(/w-\[var\(--radix-popover-trigger-width\)\]/g, 'w-[calc(100vw-2.5rem)] sm:w-[var(--radix-popover-trigger-width)]');

// 4. Dialogs
content = content.replace(/max-w-2xl/g, 'max-w-[95vw] sm:max-w-2xl');
content = content.replace(/max-w-3xl/g, 'max-w-[95vw] sm:max-w-3xl');
content = content.replace(/max-w-4xl/g, 'max-w-[95vw] sm:max-w-4xl');

// Clean up any double max-w-[95vw]
content = content.replace(/max-w-\[95vw\] sm:max-w-\[95vw\]/g, 'max-w-[95vw]');

fs.writeFileSync('src/pages/courses/CourseManagement.tsx', content); console.log('Done CourseManagement');
