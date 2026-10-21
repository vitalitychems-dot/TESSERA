# Connectome and weight templates (aggregated, real data only)

Each file is a separate layer, labelled by source and species. They are never merged into a "human brain".

| file | source | species | level | license / cite |
|---|---|---|---|---|
| celegans.json | Cook et al. 2019 hermaphrodite, `herm_full_edgelist.csv` from openworm/ConnectomeToolbox | C. elegans, whole animal | cell -> cell, chemical + electrical counts summed (6,625 edges, 448 cells) | Cook et al., Nature 571:63 (2019) |
| hemibrain.json | FlyEM hemibrain v1.2 `exported-traced-adjacencies-v1.2` (traced-roi-connections.csv) | Drosophila, central brain (partial) | ROI -> ROI: each neuron's dominant input ROI -> ROI of its output synapses (1,503 edges, 62 ROIs); no transmitter signs in export | CC BY 4.0; Scheffer et al., eLife 2020;9:e57443 |
| flywire.json | FlyWire FAFB v783 `proofread_connections_783.feather` (Zenodo 10676866) | Drosophila, whole brain | neuropil -> neuropil (same rule), excitatory = ACh, inhibitory = GABA + Glu (by predicted NT) | CC BY 4.0; Dorkenwald et al. 2024; Schlegel et al. 2024 |
| gpt2.json | openai-community/gpt2 `model.safetensors`, byte-range slice of block 0 MLP | artificial model, not a brain | residual 0-95 -> c_fc hidden 0-255 -> c_proj residual 0-95, top 5,000 abs weights | MIT |
