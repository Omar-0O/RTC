const fs = require('fs');

function fixFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Grid replacements (avoid replacing places that already have sm: or md:)
    content = content.replace(/(?<!sm:|md:)grid-cols-2/g, 'grid-cols-1 sm:grid-cols-2');

    // 2. Table wrap (simplified: just wrap <Table>...</Table> in overflow-x-auto if not already)
    // We'll skip regex wrapping here and rely on manual replacements via JS split if needed,
    // wait, regex might miss attributes. Let's do a reliable replacement for tables.
    let tablesFixed = content.replace(/(<Table[^>]*>[\s\S]*?<\/Table>)/g, function(match, tableBlock, offset, string) {
        let beforeStr = string.substring(Math.max(0, offset - 50), offset);
        if (beforeStr.includes('overflow-x-auto')) {
            return match; // already wrapped
        }
        return '<div className=\"overflow-x-auto w-full\">\n' + match + '\n</div>';
    });
    content = tablesFixed;

    // 3. Popovers widths
    content = content.replace(/w-\[400px\]/g, 'w-[calc(100vw-2.5rem)] sm:w-[400px]');
    content = content.replace(/w-80/g, 'w-[calc(100vw-2.5rem)] sm:w-80');
    content = content.replace(/w-\[var\(--radix-popover-trigger-width\)\]/g, 'w-[calc(100vw-2.5rem)] sm:w-[var(--radix-popover-trigger-width)]');

    // 4. Dialog widths
    content = content.replace(/max-w-2xl(?!\])/g, 'max-w-[95vw] sm:max-w-2xl');
    content = content.replace(/max-w-3xl(?!\])/g, 'max-w-[95vw] sm:max-w-3xl');
    content = content.replace(/max-w-4xl(?!\])/g, 'max-w-[95vw] sm:max-w-4xl');
    content = content.replace(/max-w-md(?!\])/g, 'max-w-[95vw] sm:max-w-md');
    // clean up doubles
    content = content.replace(/max-w-\[95vw\] sm:max-w-\[95vw\]/g, 'max-w-[95vw]');
    content = content.replace(/max-w-\[95vw\]\s+sm:max-w-\[95vw\]/g, 'max-w-[95vw]');

    fs.writeFileSync(path, content); 
    console.log('Done ' + path);
}

fixFile('src/pages/courses/CourseManagement.tsx');
fixFile('src/pages/caravans/CaravanManagement.tsx');
fixFile('src/pages/admin/QuranCircles.tsx');

