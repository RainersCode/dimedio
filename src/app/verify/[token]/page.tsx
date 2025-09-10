'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'already-verified'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    // Verify the token
    const users = JSON.parse(localStorage.getItem('dimedio-users') || '[]');
    const userToVerify = users.find((u: any) => u.verificationToken === token);

    if (!userToVerify) {
      setStatus('error');
      setMessage('Invalid or expired verification link');
      return;
    }

    if (userToVerify.emailVerified) {
      setStatus('already-verified');
      setMessage('This email has already been verified');
      return;
    }

    // Mark user as verified
    userToVerify.emailVerified = true;
    userToVerify.verificationToken = null; // Clear the token
    localStorage.setItem('dimedio-users', JSON.stringify(users));

    // Update current user session if it's the same user
    const currentUser = JSON.parse(localStorage.getItem('dimedio-user') || 'null');
    if (currentUser && currentUser.id === userToVerify.id) {
      currentUser.emailVerified = true;
      localStorage.setItem('dimedio-user', JSON.stringify(currentUser));
    }

    setStatus('success');
    setMessage('Your email has been successfully verified!');

    // Redirect to home page after 3 seconds
    setTimeout(() => {
      router.push('/');
    }, 3000);
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full mx-auto mb-4"></div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Verifying Email</h1>
            <p className="text-slate-600">Please wait while we verify your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Email Verified!</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <p className="text-sm text-slate-500">Redirecting to homepage in 3 seconds...</p>
          </>
        )}

        {status === 'already-verified' && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Already Verified</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Go to Homepage
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Verification Failed</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Go to Homepage
            </button>
          </>
        )}
      </div>
    </div>
  );
}