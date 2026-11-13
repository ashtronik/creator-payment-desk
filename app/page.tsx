import { CreateInvoiceForm } from "./create-invoice-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-indigo-700">CREATOR PAYMENT DESK</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Create an invoice</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Share a payment link for your work. Your client will see the details and payment options next.</p>
        <CreateInvoiceForm />
      </div>
    </main>
  );
}
