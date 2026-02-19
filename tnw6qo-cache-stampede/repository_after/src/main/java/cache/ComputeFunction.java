package cache;


@FunctionalInterface
public interface ComputeFunction<K, V> {
    

    V compute(K key) throws Exception;
}
