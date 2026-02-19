#!/usr/bin/env python3
"""
File Transfer System Evaluation Framework
Comprehensive evaluation of the file transfer system including functionality,
performance, reliability, and compliance testing.
"""

import os
import sys
import json
import time
import threading
import tempfile
import shutil
import hashlib
import statistics
from datetime import datetime
from pathlib import Path

# Add repository paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_before'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tests'))

from test_config import TestEnvironment, TestFileGenerator, TestAssertions


class FileTransferEvaluator:
    """Comprehensive evaluator for the file transfer system"""
    
    def __init__(self):
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'evaluation_version': '1.0.0',
            'system_info': self._get_system_info(),
            'requirements_compliance': {},
            'functionality_tests': {},
            'performance_metrics': {},
            'reliability_tests': {},
            'comparison_analysis': {},
            'overall_score': 0,
            'recommendations': []
        }
        
        self.test_env = None
        self.temp_dir = None
    
    def _get_system_info(self):
        """Get system information for the evaluation"""
        import platform
        return {
            'platform': platform.platform(),
            'python_version': platform.python_version(),
            'architecture': platform.architecture()[0],
            'processor': platform.processor(),
            'timestamp': datetime.now().isoformat()
        }
    
    def setup_evaluation_environment(self):
        """Set up the evaluation environment"""
        print("Setting up evaluation environment...")
        
        self.temp_dir = tempfile.mkdtemp(prefix='file_transfer_eval_')
        self.test_env = TestEnvironment().setup(port=18999)
        
        # Create comprehensive test files
        self._create_evaluation_test_files()
        
        print(f"Evaluation environment ready at: {self.temp_dir}")
    
    def _create_evaluation_test_files(self):
        """Create test files for evaluation"""
        # Text files of various sizes
        self.test_env.create_test_file('tiny.txt', content='Hello')
        self.test_env.create_test_file('small.txt', content='A' * 1024)  # 1KB
        self.test_env.create_test_file('medium.txt', content='B' * (50 * 1024))  # 50KB
        
        # Binary files
        self.test_env.create_test_file('binary_1mb.bin', size_bytes=1024*1024)  # 1MB
        self.test_env.create_test_file('binary_5mb.bin', size_bytes=5*1024*1024)  # 5MB
        
        # Special files
        self.test_env.create_test_file('empty.txt', content='')
        
        # JSON file
        json_data = {
            'test': True,
            'data': list(range(100)),
            'nested': {'key': 'value', 'array': [1, 2, 3]}
        }
        with open(os.path.join(self.test_env.server_files_dir, 'data.json'), 'w') as f:
            json.dump(json_data, f, indent=2)
    
    def evaluate_requirements_compliance(self):
        """Evaluate compliance with specified requirements"""
        print("\n" + "="*60)
        print("EVALUATING REQUIREMENTS COMPLIANCE")
        print("="*60)
        
        compliance = {}
        
        # Requirement 1: Handle multiple concurrent clients
        compliance['concurrent_clients'] = self._test_concurrent_clients()
        
        # Requirement 2: Tracks transfer progress
        compliance['progress_tracking'] = self._test_progress_tracking()
        
        # Requirement 3: Configurable ports
        compliance['configurable_ports'] = self._test_configurable_ports()
        
        # Requirement 4: TCP sockets
        compliance['tcp_sockets'] = self._test_tcp_sockets()
        
        # Requirement 5: Log all operations to files
        compliance['logging'] = self._test_logging()
        
        self.results['requirements_compliance'] = compliance
        
        # Calculate compliance score
        compliance_score = sum(1 for result in compliance.values() if result['passed']) / len(compliance) * 100
        print(f"\nRequirements Compliance Score: {compliance_score:.1f}%")
        
        return compliance_score
    
    def _test_concurrent_clients(self):
        """Test concurrent client handling"""
        print("Testing concurrent client handling...")
        
        try:
            server = self.test_env.start_server()
            time.sleep(1)
            
            # Test with 5 concurrent clients
            num_clients = 5
            files = ['tiny.txt', 'small.txt', 'medium.txt', 'data.json', 'empty.txt']
            
            results = {}
            threads = []
            
            def download_file(filename):
                client = self.test_env.get_client()
                try:
                    results[filename] = client.download(filename)
                finally:
                    self.test_env.restore_client_dirs(client)
            
            start_time = time.time()
            for filename in files:
                thread = threading.Thread(target=download_file, args=(filename,))
                threads.append(thread)
                thread.start()
            
            for thread in threads:
                thread.join(timeout=30)
            
            end_time = time.time()
            
            successful = sum(1 for success in results.values() if success)
            
            return {
                'passed': successful == num_clients,
                'details': {
                    'concurrent_clients': num_clients,
                    'successful_downloads': successful,
                    'total_time': end_time - start_time,
                    'results': results
                }
            }
            
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_progress_tracking(self):
        """Test progress tracking functionality"""
        print("Testing progress tracking...")
        
        try:
            # Check if server logs progress
            server = self.test_env.start_server()
            time.sleep(1)
            
            client = self.test_env.get_client()
            try:
                # Download a larger file to see progress
                success = client.download('binary_1mb.bin')
                
                # Check log files for progress entries
                log_files = list(Path(self.test_env.logs_dir).glob('*.log'))
                progress_found = False
                
                for log_file in log_files:
                    with open(log_file, 'r') as f:
                        content = f.read()
                        if 'Progress' in content or '%' in content:
                            progress_found = True
                            break
                
                return {
                    'passed': success and progress_found,
                    'details': {
                        'download_success': success,
                        'progress_logging_found': progress_found,
                        'log_files_checked': len(log_files)
                    }
                }
                
            finally:
                self.test_env.restore_client_dirs(client)
                
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_configurable_ports(self):
        """Test configurable port functionality"""
        print("Testing configurable ports...")
        
        try:
            # Test different ports
            test_ports = [18998, 18997]
            port_tests = []
            
            for port in test_ports:
                env = TestEnvironment().setup(port=port)
                env.create_test_file('test.txt', content='Port test')
                
                try:
                    server = env.start_server()
                    time.sleep(1)
                    
                    client = env.get_client()
                    success = client.download('test.txt')
                    env.restore_client_dirs(client)
                    
                    port_tests.append({'port': port, 'success': success})
                    
                finally:
                    env.cleanup()
            
            all_passed = all(test['success'] for test in port_tests)
            
            return {
                'passed': all_passed,
                'details': {
                    'ports_tested': test_ports,
                    'results': port_tests
                }
            }
            
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_tcp_sockets(self):
        """Test TCP socket usage"""
        print("Testing TCP socket implementation...")
        
        try:
            # Import and check socket types
            import socket
            
            # Check server implementation
            server_file = os.path.join(os.path.dirname(__file__), '..', 'repository_after', 'server.py')
            client_file = os.path.join(os.path.dirname(__file__), '..', 'repository_after', 'client.py')
            
            tcp_usage = {'server': False, 'client': False}
            
            # Check server file for TCP socket usage
            if os.path.exists(server_file):
                with open(server_file, 'r') as f:
                    content = f.read()
                    if 'SOCK_STREAM' in content or 'socket.socket(socket.AF_INET, socket.SOCK_STREAM)' in content:
                        tcp_usage['server'] = True
            
            # Check client file for TCP socket usage
            if os.path.exists(client_file):
                with open(client_file, 'r') as f:
                    content = f.read()
                    if 'SOCK_STREAM' in content or 'socket.socket(socket.AF_INET, socket.SOCK_STREAM)' in content:
                        tcp_usage['client'] = True
            
            return {
                'passed': tcp_usage['server'] and tcp_usage['client'],
                'details': tcp_usage
            }
            
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_logging(self):
        """Test logging functionality"""
        print("Testing logging functionality...")
        
        try:
            server = self.test_env.start_server()
            time.sleep(1)
            
            client = self.test_env.get_client()
            try:
                # Perform a download to generate logs
                success = client.download('small.txt')
                
                # Check for log files
                log_files = list(Path(self.test_env.logs_dir).glob('*.log'))
                
                server_logs = [f for f in log_files if 'server' in f.name]
                client_logs = [f for f in log_files if 'client' in f.name]
                
                # Check log content
                has_server_logs = len(server_logs) > 0
                has_client_logs = len(client_logs) > 0
                
                log_content_check = False
                if server_logs:
                    with open(server_logs[0], 'r') as f:
                        content = f.read()
                        if any(keyword in content for keyword in ['INFO', 'connection', 'file', 'transfer']):
                            log_content_check = True
                
                return {
                    'passed': has_server_logs and has_client_logs and log_content_check,
                    'details': {
                        'server_log_files': len(server_logs),
                        'client_log_files': len(client_logs),
                        'log_content_valid': log_content_check,
                        'total_log_files': len(log_files)
                    }
                }
                
            finally:
                self.test_env.restore_client_dirs(client)
                
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def evaluate_functionality(self):
        """Evaluate core functionality"""
        print("\n" + "="*60)
        print("EVALUATING CORE FUNCTIONALITY")
        print("="*60)
        
        functionality = {}
        
        server = self.test_env.start_server()
        time.sleep(1)
        
        # Test different file types
        test_files = [
            ('tiny.txt', 'text'),
            ('small.txt', 'text'),
            ('medium.txt', 'text'),
            ('binary_1mb.bin', 'binary'),
            ('data.json', 'json'),
            ('empty.txt', 'empty')
        ]
        
        for filename, file_type in test_files:
            print(f"Testing {file_type} file: {filename}")
            functionality[f'{file_type}_transfer'] = self._test_file_transfer(filename)
        
        # Test error handling
        functionality['error_handling'] = self._test_error_handling()
        
        # Test file integrity
        functionality['file_integrity'] = self._test_file_integrity()
        
        self.results['functionality_tests'] = functionality
        
        # Calculate functionality score
        passed_tests = sum(1 for result in functionality.values() if result['passed'])
        functionality_score = passed_tests / len(functionality) * 100
        print(f"\nFunctionality Score: {functionality_score:.1f}%")
        
        return functionality_score
    
    def _test_file_transfer(self, filename):
        """Test transfer of a specific file"""
        try:
            client = self.test_env.get_client()
            try:
                start_time = time.time()
                success = client.download(filename)
                end_time = time.time()
                
                if success:
                    # Verify file exists and integrity
                    downloaded_file = os.path.join(self.test_env.client_downloads_dir, filename)
                    original_file = os.path.join(self.test_env.server_files_dir, filename)
                    
                    if os.path.exists(downloaded_file):
                        # Check file size
                        original_size = os.path.getsize(original_file)
                        downloaded_size = os.path.getsize(downloaded_file)
                        
                        # Check checksum
                        original_checksum = self._calculate_checksum(original_file)
                        downloaded_checksum = self._calculate_checksum(downloaded_file)
                        
                        integrity_check = (original_size == downloaded_size and 
                                         original_checksum == downloaded_checksum)
                        
                        return {
                            'passed': integrity_check,
                            'details': {
                                'download_success': success,
                                'transfer_time': end_time - start_time,
                                'file_size': original_size,
                                'integrity_verified': integrity_check,
                                'size_match': original_size == downloaded_size,
                                'checksum_match': original_checksum == downloaded_checksum
                            }
                        }
                
                return {
                    'passed': False,
                    'details': {'download_success': success}
                }
                
            finally:
                self.test_env.restore_client_dirs(client)
                
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_error_handling(self):
        """Test error handling capabilities"""
        try:
            client = self.test_env.get_client()
            try:
                # Test non-existent file
                success = client.download('nonexistent_file.txt')
                
                return {
                    'passed': not success,  # Should fail gracefully
                    'details': {
                        'nonexistent_file_handled': not success,
                        'graceful_failure': True
                    }
                }
                
            finally:
                self.test_env.restore_client_dirs(client)
                
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_file_integrity(self):
        """Test file integrity verification"""
        try:
            client = self.test_env.get_client()
            try:
                success = client.download('binary_1mb.bin')
                
                if success:
                    downloaded_file = os.path.join(self.test_env.client_downloads_dir, 'binary_1mb.bin')
                    original_file = os.path.join(self.test_env.server_files_dir, 'binary_1mb.bin')
                    
                    original_checksum = self._calculate_checksum(original_file)
                    downloaded_checksum = self._calculate_checksum(downloaded_file)
                    
                    return {
                        'passed': original_checksum == downloaded_checksum,
                        'details': {
                            'original_checksum': original_checksum,
                            'downloaded_checksum': downloaded_checksum,
                            'checksums_match': original_checksum == downloaded_checksum
                        }
                    }
                
                return {
                    'passed': False,
                    'details': {'download_failed': True}
                }
                
            finally:
                self.test_env.restore_client_dirs(client)
                
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def evaluate_performance(self):
        """Evaluate performance characteristics"""
        print("\n" + "="*60)
        print("EVALUATING PERFORMANCE")
        print("="*60)
        
        performance = {}
        
        server = self.test_env.start_server()
        time.sleep(1)
        
        # Test transfer speeds
        performance['transfer_speeds'] = self._measure_transfer_speeds()
        
        # Test concurrent performance
        performance['concurrent_performance'] = self._measure_concurrent_performance()
        
        # Test scalability
        performance['scalability'] = self._test_scalability()
        
        self.results['performance_metrics'] = performance
        
        # Calculate performance score
        performance_score = self._calculate_performance_score(performance)
        print(f"\nPerformance Score: {performance_score:.1f}%")
        
        return performance_score
    
    def _measure_transfer_speeds(self):
        """Measure transfer speeds for different file sizes"""
        print("Measuring transfer speeds...")
        
        test_files = [
            ('small.txt', 1024),
            ('binary_1mb.bin', 1024*1024),
            ('binary_5mb.bin', 5*1024*1024)
        ]
        
        speeds = {}
        
        for filename, expected_size in test_files:
            client = self.test_env.get_client()
            try:
                start_time = time.time()
                success = client.download(filename)
                end_time = time.time()
                
                if success:
                    transfer_time = end_time - start_time
                    speed_mbps = (expected_size / (1024*1024)) / transfer_time
                    
                    speeds[filename] = {
                        'transfer_time': transfer_time,
                        'speed_mbps': speed_mbps,
                        'file_size_mb': expected_size / (1024*1024)
                    }
                
            finally:
                self.test_env.restore_client_dirs(client)
        
        return speeds
    
    def _measure_concurrent_performance(self):
        """Measure performance with concurrent clients"""
        print("Measuring concurrent performance...")
        
        num_clients = 3
        files = ['tiny.txt', 'small.txt', 'medium.txt']
        
        results = {}
        threads = []
        
        def download_file(filename):
            client = self.test_env.get_client()
            try:
                start_time = time.time()
                success = client.download(filename)
                end_time = time.time()
                
                results[filename] = {
                    'success': success,
                    'time': end_time - start_time
                }
            finally:
                self.test_env.restore_client_dirs(client)
        
        overall_start = time.time()
        for filename in files:
            thread = threading.Thread(target=download_file, args=(filename,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join(timeout=30)
        
        overall_end = time.time()
        
        return {
            'total_time': overall_end - overall_start,
            'concurrent_clients': num_clients,
            'individual_results': results,
            'all_successful': all(r['success'] for r in results.values())
        }
    
    def _test_scalability(self):
        """Test system scalability"""
        print("Testing scalability...")
        
        # Test with increasing number of small concurrent transfers
        scalability_results = []
        
        for num_clients in [1, 3, 5]:
            files = [f'tiny.txt'] * num_clients
            results = {}
            threads = []
            
            def download_file(filename, client_id):
                client = self.test_env.get_client()
                try:
                    start_time = time.time()
                    success = client.download(filename)
                    end_time = time.time()
                    
                    results[client_id] = {
                        'success': success,
                        'time': end_time - start_time
                    }
                finally:
                    self.test_env.restore_client_dirs(client)
            
            overall_start = time.time()
            for i, filename in enumerate(files):
                thread = threading.Thread(target=download_file, args=(filename, i))
                threads.append(thread)
                thread.start()
            
            for thread in threads:
                thread.join(timeout=30)
            
            overall_end = time.time()
            
            successful = sum(1 for r in results.values() if r['success'])
            avg_time = statistics.mean([r['time'] for r in results.values() if r['success']]) if successful > 0 else 0
            
            scalability_results.append({
                'clients': num_clients,
                'successful': successful,
                'total_time': overall_end - overall_start,
                'average_time': avg_time,
                'success_rate': successful / num_clients * 100
            })
        
        return scalability_results
    
    def _calculate_performance_score(self, performance):
        """Calculate overall performance score"""
        score = 0
        
        # Transfer speed score (30%)
        if 'transfer_speeds' in performance:
            speeds = performance['transfer_speeds']
            if speeds:
                avg_speed = statistics.mean([s['speed_mbps'] for s in speeds.values()])
                # Score based on reasonable transfer speeds (>1 MB/s = 100%)
                speed_score = min(avg_speed * 100, 100)
                score += speed_score * 0.3
        
        # Concurrent performance score (40%)
        if 'concurrent_performance' in performance:
            concurrent = performance['concurrent_performance']
            if concurrent['all_successful']:
                score += 40
        
        # Scalability score (30%)
        if 'scalability' in performance:
            scalability = performance['scalability']
            if scalability:
                avg_success_rate = statistics.mean([s['success_rate'] for s in scalability])
                score += avg_success_rate * 0.3
        
        return min(score, 100)
    
    def evaluate_reliability(self):
        """Evaluate system reliability"""
        print("\n" + "="*60)
        print("EVALUATING RELIABILITY")
        print("="*60)
        
        reliability = {}
        
        server = self.test_env.start_server()
        time.sleep(1)
        
        # Test repeated transfers
        reliability['consistency'] = self._test_transfer_consistency()
        
        # Test error recovery
        reliability['error_recovery'] = self._test_error_recovery()
        
        # Test resource cleanup
        reliability['resource_cleanup'] = self._test_resource_cleanup()
        
        self.results['reliability_tests'] = reliability
        
        # Calculate reliability score
        passed_tests = sum(1 for result in reliability.values() if result['passed'])
        reliability_score = passed_tests / len(reliability) * 100
        print(f"\nReliability Score: {reliability_score:.1f}%")
        
        return reliability_score
    
    def _test_transfer_consistency(self):
        """Test consistency across multiple transfers"""
        print("Testing transfer consistency...")
        
        try:
            results = []
            
            for i in range(5):
                client = self.test_env.get_client()
                try:
                    start_time = time.time()
                    success = client.download('small.txt')
                    end_time = time.time()
                    
                    results.append({
                        'success': success,
                        'time': end_time - start_time
                    })
                    
                finally:
                    self.test_env.restore_client_dirs(client)
                    # Clean up downloaded file for next iteration
                    downloaded_file = os.path.join(self.test_env.client_downloads_dir, 'small.txt')
                    if os.path.exists(downloaded_file):
                        os.remove(downloaded_file)
            
            all_successful = all(r['success'] for r in results)
            times = [r['time'] for r in results if r['success']]
            
            consistency_check = True
            if len(times) > 1:
                std_dev = statistics.stdev(times)
                avg_time = statistics.mean(times)
                # Check if standard deviation is reasonable (< 50% of average)
                consistency_check = std_dev < (avg_time * 0.5)
            
            return {
                'passed': all_successful and consistency_check,
                'details': {
                    'all_successful': all_successful,
                    'transfer_times': times,
                    'average_time': statistics.mean(times) if times else 0,
                    'std_deviation': statistics.stdev(times) if len(times) > 1 else 0,
                    'consistent_timing': consistency_check
                }
            }
            
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_error_recovery(self):
        """Test error recovery capabilities"""
        print("Testing error recovery...")
        
        try:
            # Test recovery after failed request
            client = self.test_env.get_client()
            try:
                # First, try to download non-existent file (should fail)
                success1 = client.download('nonexistent.txt')
                
                # Then, try to download existing file (should succeed)
                success2 = client.download('tiny.txt')
                
                return {
                    'passed': not success1 and success2,
                    'details': {
                        'failed_request_handled': not success1,
                        'recovery_successful': success2,
                        'client_recovered': not success1 and success2
                    }
                }
                
            finally:
                self.test_env.restore_client_dirs(client)
                
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def _test_resource_cleanup(self):
        """Test resource cleanup"""
        print("Testing resource cleanup...")
        
        try:
            # Perform multiple transfers and check for resource leaks
            initial_files = len(os.listdir(self.test_env.client_downloads_dir))
            
            for i in range(3):
                client = self.test_env.get_client()
                try:
                    client.download('tiny.txt')
                finally:
                    self.test_env.restore_client_dirs(client)
            
            final_files = len(os.listdir(self.test_env.client_downloads_dir))
            
            # Should have 3 more files (one per download)
            expected_files = initial_files + 3
            
            return {
                'passed': final_files == expected_files,
                'details': {
                    'initial_files': initial_files,
                    'final_files': final_files,
                    'expected_files': expected_files,
                    'proper_cleanup': final_files == expected_files
                }
            }
            
        except Exception as e:
            return {
                'passed': False,
                'details': {'error': str(e)}
            }
    
    def compare_implementations(self):
        """Compare before and after implementations"""
        print("\n" + "="*60)
        print("COMPARING IMPLEMENTATIONS")
        print("="*60)
        
        comparison = {
            'before_analysis': self._analyze_implementation('before'),
            'after_analysis': self._analyze_implementation('after'),
            'improvements': []
        }
        
        # Identify improvements
        before = comparison['before_analysis']
        after = comparison['after_analysis']
        
        if after['lines_of_code'] > before['lines_of_code']:
            comparison['improvements'].append('Increased code complexity and features')
        
        if after['features']['threading'] and not before['features']['threading']:
            comparison['improvements'].append('Added multi-threading support')
        
        if after['features']['progress_tracking'] and not before['features']['progress_tracking']:
            comparison['improvements'].append('Added progress tracking')
        
        if after['features']['retry_logic'] and not before['features']['retry_logic']:
            comparison['improvements'].append('Added retry logic with exponential backoff')
        
        if after['features']['checksum_verification'] and not before['features']['checksum_verification']:
            comparison['improvements'].append('Added checksum verification')
        
        if after['features']['logging'] and not before['features']['logging']:
            comparison['improvements'].append('Added comprehensive logging')
        
        self.results['comparison_analysis'] = comparison
        
        improvement_score = len(comparison['improvements']) * 10  # 10 points per improvement
        print(f"\nImplementation Improvement Score: {min(improvement_score, 100):.1f}%")
        
        return min(improvement_score, 100)
    
    def _analyze_implementation(self, version):
        """Analyze a specific implementation version"""
        print(f"Analyzing {version} implementation...")
        
        server_file = os.path.join(os.path.dirname(__file__), '..', f'repository_{version}', 'server.py')
        client_file = os.path.join(os.path.dirname(__file__), '..', f'repository_{version}', 'client.py')
        
        analysis = {
            'version': version,
            'files_exist': {
                'server': os.path.exists(server_file),
                'client': os.path.exists(client_file)
            },
            'lines_of_code': 0,
            'features': {
                'threading': False,
                'progress_tracking': False,
                'retry_logic': False,
                'checksum_verification': False,
                'logging': False,
                'error_handling': False
            }
        }
        
        # Analyze server file
        if os.path.exists(server_file):
            with open(server_file, 'r') as f:
                server_content = f.read()
                analysis['lines_of_code'] += len(server_content.splitlines())
                
                # Check for features
                if 'threading' in server_content.lower():
                    analysis['features']['threading'] = True
                if 'progress' in server_content.lower():
                    analysis['features']['progress_tracking'] = True
                if 'md5' in server_content.lower() or 'checksum' in server_content.lower():
                    analysis['features']['checksum_verification'] = True
                if 'logging' in server_content.lower():
                    analysis['features']['logging'] = True
                if 'except' in server_content or 'try:' in server_content:
                    analysis['features']['error_handling'] = True
        
        # Analyze client file
        if os.path.exists(client_file):
            with open(client_file, 'r') as f:
                client_content = f.read()
                analysis['lines_of_code'] += len(client_content.splitlines())
                
                # Check for features
                if 'retry' in client_content.lower() or 'backoff' in client_content.lower():
                    analysis['features']['retry_logic'] = True
                if 'progress' in client_content.lower():
                    analysis['features']['progress_tracking'] = True
                if 'md5' in client_content.lower() or 'checksum' in client_content.lower():
                    analysis['features']['checksum_verification'] = True
                if 'logging' in client_content.lower():
                    analysis['features']['logging'] = True
        
        return analysis
    
    def _calculate_checksum(self, filepath):
        """Calculate MD5 checksum of a file"""
        md5_hash = hashlib.md5()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()
    
    def calculate_overall_score(self):
        """Calculate overall evaluation score"""
        scores = []
        weights = []
        
        if 'requirements_compliance' in self.results:
            compliance_score = sum(1 for result in self.results['requirements_compliance'].values() if result['passed']) / len(self.results['requirements_compliance']) * 100
            scores.append(compliance_score)
            weights.append(0.3)  # 30% weight
        
        if 'functionality_tests' in self.results:
            functionality_score = sum(1 for result in self.results['functionality_tests'].values() if result['passed']) / len(self.results['functionality_tests']) * 100
            scores.append(functionality_score)
            weights.append(0.25)  # 25% weight
        
        if 'performance_metrics' in self.results:
            performance_score = self._calculate_performance_score(self.results['performance_metrics'])
            scores.append(performance_score)
            weights.append(0.2)  # 20% weight
        
        if 'reliability_tests' in self.results:
            reliability_score = sum(1 for result in self.results['reliability_tests'].values() if result['passed']) / len(self.results['reliability_tests']) * 100
            scores.append(reliability_score)
            weights.append(0.15)  # 15% weight
        
        if 'comparison_analysis' in self.results:
            improvement_score = len(self.results['comparison_analysis']['improvements']) * 10
            scores.append(min(improvement_score, 100))
            weights.append(0.1)  # 10% weight
        
        if scores:
            overall_score = sum(score * weight for score, weight in zip(scores, weights)) / sum(weights)
            self.results['overall_score'] = overall_score
            return overall_score
        
        return 0
    
    def generate_recommendations(self):
        """Generate recommendations based on evaluation results"""
        recommendations = []
        
        # Check requirements compliance
        if 'requirements_compliance' in self.results:
            for req, result in self.results['requirements_compliance'].items():
                if not result['passed']:
                    recommendations.append(f"Fix requirement compliance issue: {req}")
        
        # Check functionality
        if 'functionality_tests' in self.results:
            failed_tests = [test for test, result in self.results['functionality_tests'].items() if not result['passed']]
            if failed_tests:
                recommendations.append(f"Fix failed functionality tests: {', '.join(failed_tests)}")
        
        # Check performance
        if 'performance_metrics' in self.results:
            perf = self.results['performance_metrics']
            if 'transfer_speeds' in perf:
                speeds = perf['transfer_speeds']
                if speeds:
                    avg_speed = statistics.mean([s['speed_mbps'] for s in speeds.values()])
                    if avg_speed < 1.0:
                        recommendations.append("Consider optimizing transfer speeds (currently < 1 MB/s)")
        
        # General recommendations
        if self.results['overall_score'] < 90:
            recommendations.append("Consider additional testing and optimization to reach 90%+ score")
        
        if not recommendations:
            recommendations.append("Excellent implementation! All tests passed successfully.")
        
        self.results['recommendations'] = recommendations
        return recommendations
    
    def save_report(self):
        """Save evaluation report to file"""
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        report_dir = os.path.join(os.path.dirname(__file__), 'reports', timestamp[:10], timestamp[11:])
        os.makedirs(report_dir, exist_ok=True)
        
        report_file = os.path.join(report_dir, 'report.json')
        
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print(f"\nEvaluation report saved to: {report_file}")
        return report_file
    
    def print_summary(self):
        """Print evaluation summary"""
        print("\n" + "="*80)
        print("FILE TRANSFER SYSTEM EVALUATION SUMMARY")
        print("="*80)
        
        print(f"Overall Score: {self.results['overall_score']:.1f}%")
        
        if self.results['overall_score'] >= 90:
            print("🎉 EXCELLENT - Production ready!")
        elif self.results['overall_score'] >= 80:
            print("✅ GOOD - Minor improvements needed")
        elif self.results['overall_score'] >= 70:
            print("⚠️  FAIR - Several improvements needed")
        else:
            print("❌ NEEDS WORK - Major improvements required")
        
        print(f"\nEvaluation completed at: {self.results['timestamp']}")
        
        if self.results['recommendations']:
            print(f"\nRecommendations:")
            for i, rec in enumerate(self.results['recommendations'], 1):
                print(f"  {i}. {rec}")
        
        print("="*80)
    
    def cleanup(self):
        """Clean up evaluation environment"""
        if self.test_env:
            self.test_env.cleanup()
        
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
            except Exception as e:
                print(f"Warning: Could not clean up temp directory: {e}")


def main():
    """Main evaluation function"""
    print("File Transfer System - Comprehensive Evaluation")
    print("=" * 80)
    
    evaluator = FileTransferEvaluator()
    
    try:
        # Setup evaluation environment
        evaluator.setup_evaluation_environment()
        
        # Run evaluations
        evaluator.evaluate_requirements_compliance()
        evaluator.evaluate_functionality()
        evaluator.evaluate_performance()
        evaluator.evaluate_reliability()
        evaluator.compare_implementations()
        
        # Calculate overall score and generate recommendations
        evaluator.calculate_overall_score()
        evaluator.generate_recommendations()
        
        # Save report and print summary
        evaluator.save_report()
        evaluator.print_summary()
        
    except Exception as e:
        print(f"Evaluation failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    finally:
        evaluator.cleanup()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
