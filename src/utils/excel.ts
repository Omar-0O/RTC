import { utils, write } from 'xlsx';

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
    // Calculate totals
    const totalParticipants = data.participants.length;
    const totalPoints = data.participants.reduce((sum, p) => sum + (p.points || 0), 0);
    const volunteers = data.participants.filter(p => p.type === 'volunteer').length;
    const guests = data.participants.filter(p => p.type === 'guest').length;

    // Sheet 1: Activity Information (Arabic labels, no Leader)
    const activityInfo = [{
        'نوع المهمة': data.activityName,
        'اللجنة': data.committeeName,
        'التاريخ': data.date,
        'إجمالي المشاركين': totalParticipants,
        'المتطوعين': volunteers,
        'الضيوف': guests,
        'إجمالي النقاط': totalPoints,
    }];

    // Sheet 2: Participants List (Arabic labels)
    const participantsData = data.participants.map((p, index) => ({
        '#': index + 1,
        'الاسم': p.name,
        'رقم الهاتف': p.phone || '-',
        'النوع': p.type === 'volunteer' ? 'متطوع' : 'ضيف',
        'النقاط': p.points || 0
    }));

    // Create workbook with two sheets
    const wb = utils.book_new();

    // Add Activity Info sheet
    utils.book_append_sheet(
        wb,
        utils.json_to_sheet(activityInfo),
        'معلومات المهمة'
    );

    // Add Participants sheet
    if (participantsData.length > 0) {
        utils.book_append_sheet(
            wb,
            utils.json_to_sheet(participantsData),
            'المشاركين'
        );
    }

    // Generate Excel file as array buffer
    const excelBuffer = write(wb, {
        bookType: 'xlsx',
        type: 'array'
    });

    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
};
