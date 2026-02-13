import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function RequireAdmin({ children }) {
  const [state, setState] = useState({ loading: true, isAuthed: false });

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error("getSession error:", error);
          setState({ loading: false, isAuthed: false });
          return;
        }

        setState({ loading: false, isAuthed: !!data?.session });
      } catch (e) {
        console.error("RequireAdmin boot error:", e);
        if (mounted) setState({ loading: false, isAuthed: false });
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ loading: false, isAuthed: !!session });
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (state.loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <strong>Carregando…</strong>
      </div>
    );
  }

  if (!state.isAuthed) return <Navigate to="/admin" replace />;

  return children;
}
