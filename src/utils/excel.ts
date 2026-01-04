
import * as XLSX from 'xlsx';

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

export const generateGroupSubmissionExcel = (data: GroupSubmissionData): Blob => {
    const wb = XLSX.utils.book_new();

    // Create header
    const wsData = [
        ['Activity Report', data.activityName],
        ['Committee', data.committeeName],
        ['Submitted By', data.leaderName],
        ['Date', data.date],
        [], // Empty row
        ['Participant Name', 'Phone Number', 'Type', 'Role', 'Points Awarded']
    ];

    // Add participants
    data.participants.forEach(p => {
        wsData.push([
            p.name,
            p.phone || '-',
            p.type === 'volunteer' ? 'Volunteer' : 'Guest',
            p.role || '-',
            p.points?.toString() || '-'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
        { wch: 30 }, // Name
        { wch: 20 }, // Phone
        { wch: 15 }, // Type
        { wch: 15 }, // Role
        { wch: 15 }, // Points
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Participants');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
