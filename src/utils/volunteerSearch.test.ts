import { describe, expect, it, vi } from 'vitest';
import {
  fetchAllVolunteerProfiles,
  filterAndRankVolunteers,
  isKioskEmail,
  normalizePhoneDigits,
  normalizeVolunteerText,
  type SearchableVolunteer,
  type VolunteerProfilesClient,
} from './volunteerSearch';

function createMockSupabaseClient(
  batches: Array<{
    data: Array<{
      id: string;
      full_name: string | null;
      full_name_ar: string | null;
      phone: string | null;
      avatar_url: string | null;
      email: string | null;
      branch_id: string | null;
    }> | null;
    error: Error | null;
  }>
) {
  let callIndex = 0;
  const rangeCalls: Array<[number, number]> = [];
  const eqCalls: Array<[string, string]> = [];

  const client = {
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: string) => {
          eqCalls.push([col, val]);
          return builder;
        }),
        order: vi.fn(() => builder),
        range: vi.fn(async (from: number, to: number) => {
          rangeCalls.push([from, to]);
          const response = batches[callIndex] ?? { data: [], error: null };
          callIndex += 1;
          return response;
        }),
      };
      return builder;
    }),
  } as unknown as VolunteerProfilesClient;

  return { client, rangeCalls, eqCalls };
}

describe('normalizeVolunteerText', () => {
  it('normalizes Arabic hamza variants, teh marbuta, alef maqsura, tashkeel, and tatweel', () => {
    expect(normalizeVolunteerText('أَحْمَدُ إِبْرَاهِيمَ الآمِنُ')).toBe('احمد ابراهيم الامن');
    expect(normalizeVolunteerText('فاطِمَةُ الزَّهْرَاءِ')).toBe('فاطمه الزهرا');
    expect(normalizeVolunteerText('رَائِد ومُؤْمِن')).toBe('رايد ومومن');
    expect(normalizeVolunteerText('مُصْطَفَى سَلْمَىٰ')).toBe('مصطفي سلمي');
    expect(normalizeVolunteerText('عـــمـــر   مـــحـــمـــد')).toBe('عمر محمد');
  });

  it('converts Eastern Arabic and Persian numerals to ASCII digits', () => {
    expect(normalizeVolunteerText('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
    expect(normalizeVolunteerText('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });
});

describe('normalizePhoneDigits & isKioskEmail', () => {
  it('extracts ASCII digits from mixed formats and Eastern Arabic numerals', () => {
    expect(normalizePhoneDigits('+20 101-234-5678')).toBe('201012345678');
    expect(normalizePhoneDigits('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
  });

  it('detects kiosk service emails case-insensitively and returns false for null', () => {
    expect(isKioskEmail('Medaniparticipations@rtc.org')).toBe(true);
    expect(isKioskEmail('kiosk@rtc.internal')).toBe(true);
    expect(isKioskEmail('volunteer@rtc.org')).toBe(false);
    expect(isKioskEmail(null)).toBe(false);
  });
});

describe('filterAndRankVolunteers', () => {
  const sampleVolunteers: SearchableVolunteer[] = [
    {
      id: 'v1',
      full_name: 'Ahmed Mohamed Ali',
      full_name_ar: 'أحمد محمد علي',
      phone: '+201012345678',
      email: 'ahmed@rtc.org',
    },
    {
      id: 'v2',
      full_name: 'Mohamed Ahmed Hassan',
      full_name_ar: 'محمد أحمد حسن',
      phone: '01122334455',
      email: 'mohamed@rtc.org',
    },
    {
      id: 'v3',
      full_name: 'Abdulrahman Saeed',
      full_name_ar: 'عبد الرحمن سعيد',
      phone: '01234567890',
      email: null,
    },
    {
      id: 'v4',
      full_name: 'Fatma Tarek',
      full_name_ar: 'فاطمة طارق',
      phone: '01555667788',
      email: 'fatma@rtc.org',
    },
    {
      id: 'v5',
      full_name: 'Kiosk Terminal',
      full_name_ar: 'كشك المشاركات',
      phone: '+200000000000',
      email: 'Medaniparticipations@rtc.org',
    },
  ];

  it('excludes current volunteer and kiosk accounts', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, '', 'v4');
    expect(res.map((v) => v.id)).not.toContain('v4');
    expect(res.map((v) => v.id)).not.toContain('v5');
    expect(res).toHaveLength(3);
  });

  it('matches Arabic queries regardless of hamza, teh marbuta, or tashkeel', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, 'فاطمه');
    expect(res.map((v) => v.id)).toEqual(['v4']);

    const res2 = filterAndRankVolunteers(sampleVolunteers, 'احمد');
    expect(res2.map((v) => v.id)).toContain('v1');
    expect(res2.map((v) => v.id)).toContain('v2');
  });

  it('ranks prefix matches before non-prefix substring matches', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, 'احمد');
    expect(res[0].id).toBe('v1');
    expect(res[1].id).toBe('v2');
  });

  it('matches multi-word non-contiguous tokens', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, 'احمد علي');
    expect(res.map((v) => v.id)).toEqual(['v1']);
  });

  it('matches compound names with or without space', () => {
    const resNoSpace = filterAndRankVolunteers(sampleVolunteers, 'عبدالرحمن');
    expect(resNoSpace.map((v) => v.id)).toEqual(['v3']);

    const volunteersNoSpace: SearchableVolunteer[] = [
      { id: 'v6', full_name: 'Abdelrahman', full_name_ar: 'عبدالرحمن عادل', phone: '01099887766' },
    ];
    const resWithSpace = filterAndRankVolunteers(volunteersNoSpace, 'عبد الرحمن');
    expect(resWithSpace.map((v) => v.id)).toEqual(['v6']);
  });

  it('matches phone numbers across Western, Eastern Arabic, and E.164 formats', () => {
    expect(filterAndRankVolunteers(sampleVolunteers, '01012345678').map((v) => v.id)).toEqual([
      'v1',
    ]);
    expect(filterAndRankVolunteers(sampleVolunteers, '٠١٠١٢٣٤٥').map((v) => v.id)).toEqual([
      'v1',
    ]);
    expect(filterAndRankVolunteers(sampleVolunteers, '+201122334455').map((v) => v.id)).toEqual([
      'v2',
    ]);
    expect(filterAndRankVolunteers(sampleVolunteers, '010').map((v) => v.id)).toEqual(['v1']);
  });

  it('matches English names even when Arabic name exists', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, 'Fatma');
    expect(res.map((v) => v.id)).toEqual(['v4']);
  });
});

describe('fetchAllVolunteerProfiles', () => {
  it('paginates across multiple batches until a partial batch is returned and preserves both names', async () => {
    const batch1 = [
      {
        id: '1',
        full_name: 'Omar Ahmed',
        full_name_ar: 'عمر أحمد',
        phone: '01000000001',
        avatar_url: null,
        email: 'omar@rtc.org',
        branch_id: 'b1',
      },
      {
        id: '2',
        full_name: null,
        full_name_ar: 'سارة علي',
        phone: '01000000002',
        avatar_url: null,
        email: null,
        branch_id: null,
      },
    ];
    const batch2 = [
      {
        id: '3',
        full_name: 'Kiosk',
        full_name_ar: 'كشك',
        phone: '+200000000000',
        avatar_url: null,
        email: 'Medaniparticipations@rtc.org',
        branch_id: 'b1',
      },
      {
        id: '4',
        full_name: null,
        full_name_ar: null,
        phone: null,
        avatar_url: null,
        email: 'noname@rtc.org',
        branch_id: 'b1',
      },
    ];
    // pageSize = 2: batch1 has 2 items -> fetch next page [2, 3]
    // batch2 has 2 items -> fetch next page [4, 5] which returns 0 items -> stop
    const { client, rangeCalls, eqCalls } = createMockSupabaseClient([
      { data: batch1, error: null },
      { data: batch2, error: null },
      { data: [], error: null },
    ]);

    const result = await fetchAllVolunteerProfiles(client, {
      branchId: 'b1',
      pageSize: 2,
    });

    expect(rangeCalls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(eqCalls).toEqual([
      ['branch_id', 'b1'],
      ['branch_id', 'b1'],
      ['branch_id', 'b1'],
    ]);
    // Kiosk account filtered out, null-email row preserved, both names preserved
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: '1',
      full_name: 'Omar Ahmed',
      full_name_ar: 'عمر أحمد',
    });
    expect(result[1]).toMatchObject({
      id: '2',
      full_name: 'سارة علي',
      full_name_ar: 'سارة علي',
      email: null,
    });
    expect(result[2]).toMatchObject({
      id: '4',
      full_name: 'Unknown Volunteer',
      full_name_ar: null,
    });
  });

  it('falls back to fallbackClient if primary client fails or returns empty', async () => {
    const { client: primary } = createMockSupabaseClient([
      { data: null, error: new Error('RLS denied') },
    ]);
    const { client: fallback } = createMockSupabaseClient([
      {
        data: [
          {
            id: '10',
            full_name: 'Fallback Volunteer',
            full_name_ar: 'متطوع احتياطي',
            phone: '01099998888',
            avatar_url: null,
            email: 'fb@rtc.org',
            branch_id: null,
          },
        ],
        error: null,
      },
    ]);

    const result = await fetchAllVolunteerProfiles(primary, { fallbackClient: fallback });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('10');
  });
});
