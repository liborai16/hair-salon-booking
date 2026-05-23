import { useParams } from "react-router-dom";

export function CancelPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Zrušení rezervace</h1>
      <p className="text-stone-500">
        Token: <code className="text-stone-700">{token}</code>
      </p>
      <p className="text-stone-500 mt-2">
        Cancel page je v přípravě (Phase 2 step 3: view +{" "}
        <code>manageBookingByToken</code> callable).
      </p>
    </div>
  );
}
