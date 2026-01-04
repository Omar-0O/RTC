interface Participant {
    name: string;
    phone: string;
    type: 'volunteer' | 'guest';
    role?: string;
    points?: number;
}

interface GroupSubmissionData {
    leaderName: string;
    activityName: string;
    committeeName: string;
    date: string;
    participants: Participant[];
}

export const generateGroupSubmissionCSV = (data: GroupSubmissionData): Blob => {
    // Helper to escape CSV values
    const escape = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = [
        ['Activity Report', data.activityName],
        ['Committee', data.committeeName],
        ['Submitted By', data.leaderName],
        ['Date', data.date],
        [], // Empty row
        ['Participant Name', 'Phone Number', 'Type', 'Role', 'Points Awarded']
    ];

    // Add participants
    data.participants.forEach(p => {
        rows.push([
            p.name,
            p.phone || '-',
            p.type === 'volunteer' ? 'Volunteer' : 'Guest',
            p.role || '-',
            p.points?.toString() || '-'
        ]);
    });

    const csvContent = rows.map(row => row.map(escape).join(',')).join('\n');

    // Add BOM for Excel compatibility with UTF-8
    return new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
};
