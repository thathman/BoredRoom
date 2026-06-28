import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SessionJoin from '@/pages/SessionJoin';

vi.mock('@/lib/deviceExperience', () => ({ detectDeviceClass: () => 'mobile_controller' }));

describe('SessionJoin camera flow', () => {
  it('requests camera permission in the first scan-button gesture', () => {
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => {}));
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });

    render(<MemoryRouter><SessionJoin /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Scan QR code/i }));

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.any(Object), audio: false }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Requesting camera…')).toBeInTheDocument();
  });
});
