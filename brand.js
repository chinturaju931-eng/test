// Business facts supplied by CommuteAds. New workspaces start with these values.
export const defaultProfile = {
  company: 'CommuteAds', city: 'Hyderabad', cabs: '', tablets: '10',
  page: 'https://www.linkedin.com/company/commuteads/',
  website: 'https://commuteads.com/', email: 'connect@commuteads.com', phone: '6300081436',
  pricing: 'Custom pricing discussed after connecting with the client.', contact: '',
  audience: 'Brands and agencies across all sectors with budgets for premium advertising campaigns.',
  cadenceDays: '2', languages: 'both'
};

export function createPosts(profile, topic) {
  const { company, city } = profile;
  const contacts = [profile.website, profile.email, profile.phone, profile.contact].filter(Boolean).join(' | ');
  const englishCta = contacts ? `Discuss your campaign: ${contacts}` : 'Message our company page to explore a campaign.';
  const teluguCta = contacts ? `మీ క్యాంపెయిన్ గురించి మాట్లాడేందుకు: ${contacts}` : 'మీ క్యాంపెయిన్ గురించి చర్చించేందుకు మా కంపెనీ పేజీకి మెసేజ్ చేయండి.';
  const angles = [
    ['Meet your next audience',
      `Your next customer could be on their way across ${city}.\n\n${company} helps brands advertise on tablets inside cabs. Bring your message into the passenger journey with a creative built for the screen.\n\nPlanning ${topic}? Let’s discuss how in-cab advertising could fit your media mix.`,
      `${city}లో ప్రయాణాల మధ్య మీ బ్రాండ్‌ను పరిచయం చేయండి.\n\n${company} ద్వారా క్యాబ్‌లలోని టాబ్లెట్‌లపై మీ బ్రాండ్ ప్రకటనలను ప్రదర్శించవచ్చు. ఈ స్క్రీన్‌లకు అనువైన సందేశంతో ప్రయాణికులకు మీ బ్రాండ్‌ను పరిచయం చేయండి.\n\nక్యాంపెయిన్ అంశం: ${topic}\nమీ మార్కెటింగ్ ప్రణాళికలో క్యాబ్ ప్రకటనలను ఎలా చేర్చుకోవచ్చో చర్చిద్దాం.`],
    ['A creative idea for your next campaign',
      `One screen. One clear message. One next step.\n\nFor ${topic}, try a short visual, a memorable offer, and a simple call to action. Tablet advertising inside cabs gives ${city} brands another place to tell that story.\n\n${company} can help you explore the format.`,
      `ఒక స్క్రీన్. ఒక స్పష్టమైన సందేశం. ఒక సులభమైన తదుపరి అడుగు.\n\nక్యాంపెయిన్ అంశం: ${topic}\nఆకర్షణీయమైన విజువల్, గుర్తుండిపోయే ఆఫర్, స్పష్టమైన పిలుపుతో మీ ప్రకటనను రూపొందించండి. ${city}లో క్యాబ్‌లలోని టాబ్లెట్‌లు మీ బ్రాండ్ కథను చెప్పేందుకు మరో వేదిక.\n\nఈ ప్రకటన విధానం గురించి ${company}తో మాట్లాడండి.`],
    ['Build a thoughtful local media mix',
      `How does your brand show up around ${city}?\n\nAs you plan ${topic}, consider the everyday journeys that connect people with the city. ${company} offers advertising on tablets inside cabs as part of a local media mix.\n\nLet’s talk about your audience, creative, and campaign goals.`,
      `${city}లో మీ బ్రాండ్‌ను ప్రజలకు ఎలా పరిచయం చేస్తున్నారు?\n\nక్యాంపెయిన్ అంశం: ${topic}\nప్రజలను నగరంతో కలిపే రోజువారీ ప్రయాణాలను కూడా మీ ప్రచార ప్రణాళికలో పరిగణించండి. స్థానిక ప్రచారంలో భాగంగా ${company} క్యాబ్‌లలోని టాబ్లెట్‌లపై ప్రకటన అవకాశాలను అందిస్తోంది.\n\nమీ లక్ష్య ప్రేక్షకులు, క్రియేటివ్, క్యాంపెయిన్ లక్ష్యాల గురించి చర్చిద్దాం.`]
  ];
  return angles.map(([title, english, telugu], index) => {
    const parts = [];
    if (profile.languages !== 'te') parts.push(`ENGLISH\n\n${english}\n\n${englishCta}`);
    if (profile.languages !== 'en') parts.push(`తెలుగు\n\n${telugu}\n\n${teluguCta}`);
    return { title, body: `${parts.join('\n\n──────────\n\n')}\n\n#${city.replace(/\s/g, '')} #BrandMarketing #CabAdvertising`, topic, language: profile.languages, planDay: 1 + index * Number(profile.cadenceDays) };
  });
}
