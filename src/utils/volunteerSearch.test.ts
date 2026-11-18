import { describe, expect, it, vi } from 'vitest';
import {
  fetchAllVolunteerProfiles,
  filterAndRankVolunteers,
  isKioskEmail,
  isSystemPlaceholderVolunteer,
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
  const orCalls: string[] = [];

  const client = {
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: string) => {
          eqCalls.push([col, val]);
          return builder;
        }),
        or: vi.fn((filters: string) => {
          orCalls.push(filters);
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

  return { client, rangeCalls, eqCalls, orCalls };
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

describe('normalizePhoneDigits, isKioskEmail & isSystemPlaceholderVolunteer', () => {
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

  it('excludes only kiosk and RTC Admin system placeholder accounts while keeping human officials', () => {
    expect(
      isSystemPlaceholderVolunteer({
        full_name: 'RTC Admin',
        full_name_ar: null,
        email: 'admin@rtc.org',
      })
    ).toBe(true);
    expect(
      isSystemPlaceholderVolunteer({
        full_name: 'Omar Official',
        full_name_ar: 'عمر مسؤول',
        email: 'omar.official@rtc.org',
      })
    ).toBe(false);
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
    {
      id: 'v6',
      full_name: 'RTC Admin',
      full_name_ar: null,
      phone: null,
      email: 'root@rtc.org',
    },
  ];

  it('excludes current volunteer, kiosk accounts, and RTC Admin placeholder while keeping officials', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, '', 'v4');
    expect(res.map((v) => v.id)).not.toContain('v4');
    expect(res.map((v) => v.id)).not.toContain('v5');
    expect(res.map((v) => v.id)).not.toContain('v6');
    expect(res).toHaveLength(3);
  });

  it('sorts alphabetically according to the requested UI locale (ar vs en)', () => {
    const mixedLocaleVolunteers: SearchableVolunteer[] = [
      { id: 'i1', full_name: 'Ikhlas Abdo', full_name_ar: 'إخلاص عبده' },
      { id: 'b1', full_name: 'Basma Adel', full_name_ar: 'بسمة عادل' },
      { id: 'a1', full_name: 'Abrar Hassan', full_name_ar: 'أبرار حسن' },
    ];

    const enSorted = filterAndRankVolunteers(mixedLocaleVolunteers, '', null, { locale: 'en' });
    expect(enSorted.map((v) => v.id)).toEqual(['a1', 'b1', 'i1']);

    const arSorted = filterAndRankVolunteers(mixedLocaleVolunteers, '', null, { locale: 'ar' });
    expect(arSorted.map((v) => v.id)).toEqual(['a1', 'i1', 'b1']);
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
      { id: 'v7', full_name: 'Abdelrahman', full_name_ar: 'عبدالرحمن عادل', phone: '01099887766' },
    ];
    const resWithSpace = filterAndRankVolunteers(volunteersNoSpace, 'عبد الرحمن');
    expect(resWithSpace.map((v) => v.id)).toEqual(['v7']);
  });

  it('matches phone numbers across Western, Eastern Arabic, E.164, and 10-digit leading-zero-stripped formats', () => {
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
    expect(filterAndRankVolunteers(sampleVolunteers, '10 12345678').map((v) => v.id)).toEqual([
      'v1',
    ]);
  });

  it('matches English names even when Arabic name exists', () => {
    const res = filterAndRankVolunteers(sampleVolunteers, 'Fatma');
    expect(res.map((v) => v.id)).toEqual(['v4']);
  });
});

describe('fetchAllVolunteerProfiles', () => {
  it('paginates across multiple batches and includes branch_id IS NULL when branchId is provided', async () => {
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
    const { client, rangeCalls, orCalls } = createMockSupabaseClient([
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
    expect(orCalls).toEqual([
      'branch_id.eq.b1,branch_id.is.null',
      'branch_id.eq.b1,branch_id.is.null',
      'branch_id.eq.b1,branch_id.is.null',
    ]);
    // Kiosk account filtered out, null-email & null-branch rows preserved, both names preserved
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
