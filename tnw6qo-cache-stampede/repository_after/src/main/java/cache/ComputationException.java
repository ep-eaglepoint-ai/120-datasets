package cache;

public class ComputationException extends RuntimeException {
    
    private static final long serialVersionUID = 1L;
    
   
    public ComputationException(String message, Throwable cause) {
        super(message, cause);
    }
    
    
    public ComputationException(Throwable cause) {
        super("Computation failed", cause);
    }
}
