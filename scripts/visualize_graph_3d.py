import json
import networkx as nx
import plotly.graph_objects as go
import time
import os

def main():
    graph_path = os.path.join('graphify-out', 'graph.json')
    print(f"Loading {graph_path}...")
    with open(graph_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'links' in data and 'edges' not in data:
        data['edges'] = data.pop('links')
    
    # Create the graph
    G = nx.node_link_graph(data, directed=False)
    
    print(f"Graph loaded: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
    
    # For a very large graph, layout computation is expensive. 
    # We take the largest connected component to ensure it's a connected structure.
    components = sorted(nx.connected_components(G), key=len, reverse=True)
    if components:
        G = G.subgraph(components[0])
        print(f"Using largest connected component: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
        
    # If it's still > 5000 nodes, we can sample it for the 3D viz so it doesn't crash the browser
    if G.number_of_nodes() > 5000:
        print("Graph is very large. To ensure the 3D browser view is smooth, calculating pagerank to filter top 5000 nodes...")
        pr = nx.pagerank(G)
        top_nodes = sorted(pr.keys(), key=lambda k: pr[k], reverse=True)[:5000]
        G = G.subgraph(top_nodes)
        print(f"Filtered to top 5000 nodes by PageRank: {G.number_of_edges()} edges.")

    print("Computing 3D layout (this may take 1-2 minuti)...")
    start = time.time()
    # spring_layout with dim=3
    pos = nx.spring_layout(G, dim=3, iterations=40, seed=42)
    print(f"Layout computed in {time.time()-start:.2f} seconds.")

    print("Building Plotly figure...")
    edge_x = []
    edge_y = []
    edge_z = []
    for edge in G.edges():
        x0, y0, z0 = pos[edge[0]]
        x1, y1, z1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        edge_z.extend([z0, z1, None])

    edge_trace = go.Scatter3d(
        x=edge_x, y=edge_y, z=edge_z,
        line=dict(width=0.5, color='#888'),
        hoverinfo='none',
        mode='lines')

    node_x = []
    node_y = []
    node_z = []
    node_text = []
    node_color = []
    
    for node in G.nodes():
        x, y, z = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_z.append(z)
        
        # Get node attributes
        attrs = G.nodes[node]
        label = attrs.get('label', str(node))
        community = attrs.get('community', 0)
        
        node_text.append(f"{label} (Comm: {community})")
        
        # Try to make color numeric
        try:
            val = int(community)
        except (ValueError, TypeError):
            val = hash(community) % 100
        node_color.append(val)

    node_trace = go.Scatter3d(
        x=node_x, y=node_y, z=node_z,
        mode='markers',
        hoverinfo='text',
        text=node_text,
        marker=dict(
            showscale=True,
            colorscale='Viridis',
            color=node_color,
            size=4,
            line=dict(width=0.5, color='DarkSlateGrey')
        )
    )

    fig = go.Figure(data=[edge_trace, node_trace],
                    layout=go.Layout(
                        title=dict(text="GeoKanban 3D Architecture Graph", font=dict(size=16)),
                        showlegend=False,
                        hovermode='closest',
                        margin=dict(b=20,l=5,r=5,t=40),
                        scene=dict(
                            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                            zaxis=dict(showgrid=False, zeroline=False, showticklabels=False)
                        )
                    ))

    out_file = os.path.join("graphify-out", "graph_3d.html")
    fig.write_html(out_file)
    print(f"3D visualization saved to {out_file}. Double click to open it in your browser!")

if __name__ == '__main__':
    main()
