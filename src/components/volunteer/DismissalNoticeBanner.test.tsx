import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DismissalNoticeBanner } from './DismissalNoticeBanner';

describe('DismissalNoticeBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders formal Arabic dismissal notice with volunteer name and temporary dismissal badge', () => {
    render(
      <DismissalNoticeBanner
        isRTL={true}
        volunteerName="عمر أحمد"
        dismissalReason="target_not_met"
      />
    );

    expect(screen.getByText('إشعار إداري — عمر أحمد')).toBeInTheDocument();
    expect(screen.getByText('مرفود مؤقتاً')).toBeInTheDocument();
    expect(
      screen.getByText(/سبب القرار: عدم استيفاء الحد الأدنى للمشاركات الشهرية المقررة/)
    ).toBeInTheDocument();
  });

  it('renders generic formal heading when volunteer name is missing', () => {
    render(
      <DismissalNoticeBanner
        isRTL={true}
        volunteerName="   "
        dismissalReason={null}
      />
    );

    expect(screen.getByText('إشعار إداري بشأن حالة العضوية')).toBeInTheDocument();
    expect(
      screen.getByText(/عدم استيفاء الحد الأدنى للمشاركات الشهرية أو وجود غرامة مالية غير مسددة/)
    ).toBeInTheDocument();
  });

  it.each([
    ['target_not_met', 'عدم استيفاء الحد الأدنى للمشاركات الشهرية المقررة'],
    ['unpaid_fine', 'وجود غرامة مالية مستحقة غير مسددة على الحساب'],
    [
      'target_and_fine',
      'عدم استيفاء الحد الأدنى للمشاركات الشهرية ووجود غرامة مالية غير مسددة',
    ],
    ['manual', 'قرار إداري لحين مراجعة إدارة الموارد البشرية (HR)'],
  ] as const)(
    'displays exact formal Arabic reason text for %s',
    (reason, expectedText) => {
      render(
        <DismissalNoticeBanner
          isRTL={true}
          volunteerName="متطوع"
          dismissalReason={reason}
        />
      );

      expect(screen.getByText(expectedText, { exact: false })).toBeInTheDocument();
    }
  );

  it('renders formal English notice when isRTL is false', () => {
    render(
      <DismissalNoticeBanner
        isRTL={false}
        volunteerName="Omar"
        dismissalReason="unpaid_fine"
      />
    );

    expect(screen.getByText('Administrative Notice — Omar')).toBeInTheDocument();
    expect(screen.getByText('Temporarily Dismissed')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Outstanding unpaid fine on the account/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Official Notice' })).toBeInTheDocument();
  });

  it('auto-opens modal dialog when rtc_dismissed_welcome_modal is set in sessionStorage and clears it', async () => {
    sessionStorage.setItem('rtc_dismissed_welcome_modal', '1');

    render(
      <DismissalNoticeBanner
        isRTL={true}
        volunteerName="أحمد"
        dismissalReason="target_and_fine"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('إشعار رسمي بشأن حالة العضوية')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('السيد المتطوع / أحمد، نحيطكم علماً بالآتي:')).toBeInTheDocument();
    expect(sessionStorage.getItem('rtc_dismissed_welcome_modal')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'أقر بالاطلاع والمتابعة لتسجيل المشاركات' })
    );

    await waitFor(() => {
      expect(
        screen.queryByText('إشعار رسمي بشأن حالة العضوية')
      ).not.toBeInTheDocument();
    });
  });

  it('opens modal dialog when clicking details button', async () => {
    render(
      <DismissalNoticeBanner
        isRTL={true}
        volunteerName="سارة"
        dismissalReason="manual"
      />
    );

    expect(
      screen.queryByText('إشعار رسمي بشأن حالة العضوية')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'تفاصيل القرار والإجراءات المطلوبة' })
    );

    await waitFor(() => {
      expect(
        screen.getByText('إشعار رسمي بشأن حالة العضوية')
      ).toBeInTheDocument();
    });
  });
});
