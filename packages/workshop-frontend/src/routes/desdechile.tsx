import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthenticatedApi } from "../AuthContext";

export const Route = createFileRoute("/desdechile")({ component: DesdeChileBridge });

export function DesdeChileBridge() {
  const { authenticatedApi } = useAuthenticatedApi();
  const [error, setError] = useState("");
  const open = async () => {
    setError("");
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem("desdechile.state", state);
      window.location.assign(
        await authenticatedApi.createDesdeChileSession({
          action: "dashboard",
          returnPath: "/panel",
          state,
        }),
      );
    } catch {
      setError("No pudimos abrir DesdeChile. Intenta nuevamente.");
    }
  };
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-10">
      <img
        src="https://branding.nuevauno.com/logos/nuevauno-logo-light.svg"
        alt="NUEVAUNO"
        className="h-8 w-fit"
      />
      <p className="text-xs uppercase tracking-[.16em] text-kumo-subtle">App oficial</p>
      <h1 className="text-3xl font-normal text-kumo-default">DesdeChile</h1>
      <p className="max-w-xl text-sm text-kumo-subtle">
        Administra la ficha, catálogo compartido, posición, promoción y métricas de tu organización
        con la sesión que ya tienes en NUEVAUNO.
      </p>
      <button
        type="button"
        onClick={open}
        className="w-fit rounded-lg bg-kumo-brand px-4 py-2 text-sm font-normal text-kumo-inverse"
      >
        Abrir panel privado
      </button>
      {error && (
        <p role="alert" className="text-sm text-kumo-danger">
          {error}
        </p>
      )}
    </section>
  );
}
