from multiprocessing import Process
regressTuple = [(x,) for x in regressList]
processes = []
for i in range(len(regressList)):
    processes.append(
        Process(
            target=runRegressWriteStatus,
            args=regressTuple[i]))
for process in processes:
    process.start()
for process in processes:
    process.join()