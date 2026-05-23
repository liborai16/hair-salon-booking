import { Link } from "react-router-dom";

export function Landing() {
  return (
    <div className="text-center py-16">
      <h1 className="text-4xl font-semibold tracking-tight mb-4">
        Salon Krásná
      </h1>
      <p className="text-stone-600 mb-8 max-w-xl mx-auto">
        Rezervujte si termín online. Vyberete službu, kadeřníka a čas — vše
        na pár kliků.
      </p>
      <Link
        to="/book"
        className="inline-block bg-stone-900 text-white px-8 py-3 rounded-md hover:bg-stone-800 transition"
      >
        Rezervovat termín
      </Link>
    </div>
  );
}
