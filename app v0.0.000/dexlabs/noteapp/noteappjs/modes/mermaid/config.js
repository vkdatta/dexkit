export const $ = id => document.getElementById(id);

export const SAMPLE = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Proceed]
    B -->|No| D[Stop]
    C --> E[Finish]
    D --> E`;

export const DEFAULTS = {
    bg:'#000000', line:'#909090',
    node1:'#181c1f', border1:'#bec2cb',
    node2:'#171717', border2:'#606060',
    node3:'#272727', border3:'#cacaca',
    text:'#fafafa', edgeText:'#cacaca',
    font:'Classy', fontSize:15,
};

export const COLOR_PAIRS = [
    ['s-bg','s-bg-hex','bg'],
    ['s-line','s-line-hex','line'],
    ['s-node1','s-node1-hex','node1'],
    ['s-border1','s-border1-hex','border1'],
    ['s-node2','s-node2-hex','node2'],
    ['s-border2','s-border2-hex','border2'],
    ['s-node3','s-node3-hex','node3'],
    ['s-border3','s-border3-hex','border3'],
    ['s-text','s-text-hex','text'],
    ['s-edge-text','s-edge-text-hex','edgeText'],
];

export const FONT_URL = 'https://vkfonts.storage.googleapis.com/classy.woff2';
