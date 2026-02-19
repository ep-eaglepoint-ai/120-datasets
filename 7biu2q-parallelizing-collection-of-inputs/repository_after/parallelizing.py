from multiprocessing import Pool, cpu_count

def run_parallel_tasks(regress_list, target_func):
    max_workers = cpu_count()
    
    with Pool(processes=max_workers) as pool:
        results = pool.map(target_func, regress_list)
    
    return results
