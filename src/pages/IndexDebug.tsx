const IndexDebug = () => {
  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      backgroundColor: 'white', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: 'black'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>
          DEBUG PAGE
        </h1>
        <p style={{ fontSize: '18px', color: '#666' }}>
          If you can see this, React is working but CSS might be the issue
        </p>
        <button 
          style={{ 
            marginTop: '20px', 
            padding: '10px 20px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => alert('Button works!')}
        >
          Test Button
        </button>
      </div>
    </div>
  );
};

export default IndexDebug;