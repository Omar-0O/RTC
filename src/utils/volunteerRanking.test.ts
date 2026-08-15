import { describe, it, expect } from 'vitest';
import { processTopVolunteersByGrade, RawVolunteerItem } from './volunteerRanking';

describe('processTopVolunteersByGrade', () => {
  it('should return empty array when input is empty', () => {
    expect(processTopVolunteersByGrade([])).toEqual([]);
  });

  it('should sort volunteers strictly by count descending within each grade', () => {
    const input: RawVolunteerItem[] = [
      { id: '1', full_name: 'Ahmed', full_name_ar: 'أحمد', avatar_url: null, level: 'under_follow_up', count: 5 },
      { id: '2', full_name: 'Mohamed', full_name_ar: 'محمد', avatar_url: null, level: 'under_follow_up', count: 30 },
      { id: '3', full_name: 'Ali', full_name_ar: 'علي', avatar_url: null, level: 'under_follow_up', count: 12 },
      { id: '4', full_name: 'Hassan', full_name_ar: 'حسن', avatar_url: null, level: 'under_follow_up', count: 2 },
    ];

    const result = processTopVolunteersByGrade(input);
    expect(result).toHaveLength(1);
    expect(result[0].grade).toBe('under_follow_up');
    expect(result[0].volunteers).toHaveLength(3);

    // Should be Mohamed (30), Ali (12), Ahmed (5)
    expect(result[0].volunteers[0].id).toBe('2');
    expect(result[0].volunteers[0].count).toBe(30);
    expect(result[0].volunteers[1].id).toBe('3');
    expect(result[0].volunteers[1].count).toBe(12);
    expect(result[0].volunteers[2].id).toBe('1');
    expect(result[0].volunteers[2].count).toBe(5);
  });

  it('should group volunteers into their respective grade tiers correctly', () => {
    const input: RawVolunteerItem[] = [
      { id: '1', full_name: 'Resp User', full_name_ar: 'مسئول 1', avatar_url: null, level: 'responsible', count: 15 },
      { id: '2', full_name: 'Proj Resp', full_name_ar: 'مشروع مسئول 1', avatar_url: null, level: 'project_responsible', count: 20 },
      { id: '3', full_name: 'Silver User', full_name_ar: 'فضة 1', avatar_url: null, level: 'silver', count: 10 },
      { id: '4', full_name: 'Gold User', full_name_ar: 'ذهب 1', avatar_url: null, level: 'gold', count: 25 },
      { id: '5', full_name: 'Platinum User', full_name_ar: 'بلاتين 1', avatar_url: null, level: 'platinum', count: 30 },
    ];

    const result = processTopVolunteersByGrade(input);

    const responsibleGroup = result.find((g) => g.grade === 'responsible');
    const projRespGroup = result.find((g) => g.grade === 'project_responsible');
    const followUpGroup = result.find((g) => g.grade === 'under_follow_up');

    // responsible maps responsible, platinum, diamond -> Platinum User (30), Resp User (15)
    expect(responsibleGroup?.volunteers).toHaveLength(2);
    expect(responsibleGroup?.volunteers[0].id).toBe('5');
    expect(responsibleGroup?.volunteers[1].id).toBe('1');

    // project_responsible maps project_responsible, gold -> Gold User (25), Proj Resp (20)
    expect(projRespGroup?.volunteers).toHaveLength(2);
    expect(projRespGroup?.volunteers[0].id).toBe('4');
    expect(projRespGroup?.volunteers[1].id).toBe('2');

    // under_follow_up maps silver, bronze, under_follow_up... -> Silver User (10)
    expect(followUpGroup?.volunteers).toHaveLength(1);
    expect(followUpGroup?.volunteers[0].id).toBe('3');
  });

  it('should handle case-insensitive levels', () => {
    const input: RawVolunteerItem[] = [
      { id: '1', full_name: 'User 1', full_name_ar: 'مستخدم 1', avatar_url: null, level: 'RESPONSIBLE', count: 10 },
      { id: '2', full_name: 'User 2', full_name_ar: 'مستخدم 2', avatar_url: null, level: 'Gold', count: 8 },
    ];

    const result = processTopVolunteersByGrade(input);
    expect(result).toHaveLength(2);
  });
});
