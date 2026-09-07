import type { MapDefinition } from '../game/maps/schema';

interface ExpeditionCard {
  title: string;
  artwork?: string;
  description?: string;
  duration?: string;
  difficulty?: string;
  routes?: string;
}

/** Editorial estimates and artwork stay outside simulation data and its network hash.
 * Add a presentation here for a new map; unlisted maps show their own name only.
 */
const cards:Record<string,ExpeditionCard>={
  'forest-crossing':{title:'Forest Crossing',artwork:'/illustrations/forest-crossing.svg',description:'Planks, stones and a little help from a tree.',duration:'5–10 min',difficulty:'Moderate',routes:'3 paths'},
};

export function updateExpeditionCard(element:HTMLElement,map:MapDefinition){
  const card=cards[map.id]??{title:map.name};
  element.querySelector('h2')!.textContent=card.title;
  const description=element.querySelector<HTMLElement>('.exp-card-description')!;
  description.hidden=!card.description;description.textContent=card.description??'';
  element.classList.toggle('exp-card-no-art',!card.artwork);
  const image=element.querySelector('img')!;
  image.hidden=!card.artwork;
  if(card.artwork)image.src=card.artwork;else image.removeAttribute('src');
  for(const fact of ['duration','difficulty','routes'] as const){
    const row=element.querySelector<HTMLElement>(`[data-fact="${fact}"]`)!;
    row.hidden=!card[fact];row.querySelector('dd')!.textContent=card[fact]??'';
  }
  element.querySelector<HTMLElement>('dl')!.hidden=!card.duration&&!card.difficulty&&!card.routes;
}
