import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';

const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#061430] text-white px-4">
    <div className="max-w-md w-full text-center p-8 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl">
      <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6 text-red-300" />
      </div>
      <p className="text-xs font-extrabold uppercase tracking-widest text-blue-300">404 Not Found</p>
      <h1 className="mt-2 text-2xl font-extrabold">Page Not Found</h1>
      <p className="mt-2 text-sm text-blue-100/80">
        The page you requested does not exist or has been moved.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Go to Student Login</span>
      </Link>
    </div>
  </div>
);

export default NotFoundPage;

