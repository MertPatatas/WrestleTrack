'use client';

import { useState } from 'react';
import { InstallCard } from '../components/InstallCard';
import { PageHeader } from '../components/PageHeader';
import { promotions } from '../data/mock';
import type { PromotionId } from '../data/types';
import { deviceTimeZone } from '../lib/dates';
import { useMounted } from '../lib/useMounted';

export function ProfileView() {
  const mounted = useMounted();
  // Solo estado local por ahora; se guardará en el navegador o en el backend más adelante.
  const [favorites, setFavorites] = useState<Record<PromotionId, boolean>>({
    wwe: true,
    aew: true,
    cmll: true,
    aaa: true,
    njpw: true,
    other: true,
  });

  return (
    <>
      <PageHeader title="Perfil" />

      <section>
        <h2 className="section-title section-title--solo">Promociones que sigo</h2>
        <div className="card card--list">
          {promotions
            .filter((p) => p.id !== 'other')
            .map((p) => (
            <div key={p.id} className="row">
              <span id={`fav-${p.id}`}>{p.name}</span>
              <button
                type="button"
                role="switch"
                aria-checked={favorites[p.id]}
                aria-labelledby={`fav-${p.id}`}
                className="switch"
                onClick={() => setFavorites((f) => ({ ...f, [p.id]: !f[p.id] }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title section-title--solo">Zona horaria</h2>
        <div className="card card--list">
          <div className="row">
            <span>{mounted ? deviceTimeZone() : ' '}</span>
          </div>
        </div>
      </section>

      <InstallCard />
    </>
  );
}
