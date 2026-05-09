import { getPublishedCount } from "@/api";
import AASSearchBar from "@/components/feature/app/AASSearchBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Layers,
  ShieldCheck,
  LayoutTemplate,
  Puzzle,
  Cpu,
} from "lucide-react";

export const metadata = { title: "KETI ezAAS Model Hub" };
export const dynamic = "force-dynamic";

export default async function Home() {
  let aasCount = 0;
  let smCount = 0;
  let insCount = 0;

  try {
    const raw = await getPublishedCount();
    const list: Array<{ ty: string; cnt: number }> = Array.isArray(raw)
      ? raw
      : [];
    aasCount = list.find((r) => r.ty === "aasmodel")?.cnt ?? 0;
    smCount  = list.find((r) => r.ty === "submodel")?.cnt ?? 0;
    insCount = list.find((r) => r.ty === "instance")?.cnt ?? 0;
  } catch {
    // backend unreachable — counts stay 0
  }

  const statCards = [
    { href: "/aas",      icon: LayoutTemplate, label: "AAS Templates",      count: aasCount,  color: "text-blue-600",    bg: "bg-blue-50" },
    { href: "/submodel", icon: Puzzle,          label: "Submodel Templates", count: smCount,   color: "text-violet-600",  bg: "bg-violet-50" },
    { href: "/instance", icon: Layers,          label: "AAS Instances",      count: insCount,  color: "text-emerald-600", bg: "bg-emerald-50", isNew: true },
  ];

  const features = [
    {
      icon: LayoutTemplate,
      title: "Central Template Repository",
      description:
        "Store and manage all AAS and Submodel templates in one place, versioned and always accessible.",
    },
    {
      icon: ShieldCheck,
      title: "AAS Standard Compliant",
      description:
        "Every template strictly follows the Asset Administration Shell (AAS) meta-model specification.",
    },
    {
      icon: Layers,
      title: "No-Code Instance Creation",
      description:
        "Create AAS instances without knowing the meta-model — just pick a template and fill in values.",
    },
    {
      icon: Cpu,
      title: "Full REST API Support",
      description:
        "Integrate seamlessly with your existing systems through a comprehensive REST API.",
    },
  ];

  return (
    <div className="flex flex-col">

      {/* ── Hero / Search ─────────────────────────────────────────── */}
      <section className="border-b border-border bg-muted/40 py-10">
        <div className="mx-auto max-w-screen-xl px-4 lg:px-8">
          <AASSearchBar />

          {/* Stat cards */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex size-9 items-center justify-center rounded-lg ${card.bg}`}>
                          <Icon className={`size-4 ${card.color}`} />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">
                          {card.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {"isNew" in card && card.isNew && (
                          <Badge variant="secondary" className="text-xs">New</Badge>
                        )}
                        <span className="text-xl font-bold text-foreground tabular-nums">
                          {card.count}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Intro card ────────────────────────────────────────────── */}
      <section className="py-12 border-b border-border">
        <div className="mx-auto max-w-screen-xl px-4 lg:px-8">
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-center gap-8 px-8 py-12 text-center lg:flex-row lg:items-center lg:gap-16 lg:px-14 lg:text-left">
              <div className="flex flex-col items-center gap-5 lg:items-start lg:flex-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                    Industrial Digital Twin
                  </p>
                  <h2 className="text-3xl font-bold text-foreground lg:text-4xl text-balance">
                    ezAAS Model Hub
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md text-pretty">
                    A central hub for efficient creation and management of digital
                    twins for industrial assets, built on the Asset Administration
                    Shell (AAS) standard.
                  </p>
                </div>
                <Link
                  href="/aas"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  Browse AAS Templates
                </Link>
              </div>
              <div className="shrink-0">
                <img
                  src="/assets/media/aas/aas_main_ob.png"
                  alt="AAS Model Hub illustration"
                  className="w-48 lg:w-64"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Feature cards ─────────────────────────────────────────── */}
      <section className="py-12 border-b border-border">
        <div className="mx-auto max-w-screen-xl px-4 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold text-foreground">Key Features</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you need to work with AAS templates
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="h-full">
                  <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug text-balance">
                      {f.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
                      {f.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── About / Video ─────────────────────────────────────────── */}
      <section className="py-12">
        <div className="mx-auto max-w-screen-xl px-4 lg:px-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-foreground">About</h2>
            <p className="mt-1 text-sm text-muted-foreground">ezAAS Model Hub</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              className="aspect-video w-full"
              src="https://www.youtube.com/embed/n4IDBR2C1CY?si=jvDaO89Su0huplNn"
              allowFullScreen
              title="ezAAS Model Hub introduction video"
            />
          </div>
        </div>
      </section>

    </div>
  );
}
